-- V49: Rebalance supplier-material links so each material has multiple supplier options.
-- Strategy:
-- - Keep existing valid links.
-- - Ensure each material has at least 2 suppliers (or 1 if only one active supplier exists).
-- - Deterministic assignment using material_code hash, so reruns stay stable.

INSERT INTO data_integrity_snapshots(stage, metric_name, metric_value)
SELECT 'BEFORE', 'v49_materials_without_supplier_links', COUNT(*)
FROM materials m
WHERE NOT EXISTS (
    SELECT 1 FROM supplier_materials sm WHERE sm.material_id = m.id
);

INSERT INTO data_integrity_snapshots(stage, metric_name, metric_value)
SELECT 'BEFORE', 'v49_materials_with_single_supplier_link', COUNT(*)
FROM (
    SELECT sm.material_id, COUNT(*) AS c
    FROM supplier_materials sm
    GROUP BY sm.material_id
    HAVING COUNT(*) = 1
) t;

WITH supplier_pool AS (
    SELECT
        s.id AS supplier_id,
        ROW_NUMBER() OVER (
            ORDER BY
                COALESCE(s.lead_time_days, 999999) ASC,
                COALESCE(s.rating, 0) DESC,
                COALESCE(s.name, ''),
                s.id
        ) AS rn
    FROM suppliers s
    WHERE LOWER(COALESCE(s.status, 'active')) = 'active'
),
supplier_count AS (
    SELECT COUNT(*)::int AS cnt FROM supplier_pool
),
material_base AS (
    SELECT
        m.id AS material_id,
        m.material_code,
        COALESCE(ec.existing_links, 0) AS existing_links,
        CASE
            WHEN sc.cnt >= 2 THEN 2
            WHEN sc.cnt = 1 THEN 1
            ELSE 0
        END AS target_links,
        sc.cnt AS supplier_cnt
    FROM materials m
    CROSS JOIN supplier_count sc
    LEFT JOIN (
        SELECT material_id, COUNT(*)::int AS existing_links
        FROM supplier_materials
        GROUP BY material_id
    ) ec ON ec.material_id = m.id
),
material_need AS (
    SELECT
        mb.material_id,
        mb.material_code,
        mb.supplier_cnt,
        GREATEST(mb.target_links - mb.existing_links, 0) AS missing_links
    FROM material_base mb
    WHERE mb.target_links > mb.existing_links
),
candidate_seed AS (
    SELECT
        mn.material_id,
        mn.material_code,
        mn.missing_links,
        gs.seed_idx,
        ((ABS(hashtext(mn.material_code || ':' || gs.seed_idx::text)) % mn.supplier_cnt) + 1)::int AS supplier_rn
    FROM material_need mn
    JOIN LATERAL generate_series(0, 15) gs(seed_idx) ON true
),
candidate_suppliers AS (
    SELECT
        cs.material_id,
        sp.supplier_id,
        cs.seed_idx
    FROM candidate_seed cs
    JOIN supplier_pool sp ON sp.rn = cs.supplier_rn
),
deduped_candidates AS (
    SELECT DISTINCT ON (material_id, supplier_id)
        material_id,
        supplier_id,
        seed_idx
    FROM candidate_suppliers
    ORDER BY material_id, supplier_id, seed_idx
),
available_candidates AS (
    SELECT
        dc.material_id,
        dc.supplier_id,
        ROW_NUMBER() OVER (PARTITION BY dc.material_id ORDER BY dc.seed_idx, dc.supplier_id) AS pick_rank
    FROM deduped_candidates dc
    WHERE NOT EXISTS (
        SELECT 1
        FROM supplier_materials sm
        WHERE sm.material_id = dc.material_id
          AND sm.supplier_id = dc.supplier_id
    )
),
final_pick AS (
    SELECT
        ac.material_id,
        ac.supplier_id
    FROM available_candidates ac
    JOIN material_need mn ON mn.material_id = ac.material_id
    WHERE ac.pick_rank <= mn.missing_links
)
INSERT INTO supplier_materials (supplier_id, material_id)
SELECT fp.supplier_id, fp.material_id
FROM final_pick fp
ON CONFLICT (supplier_id, material_id) DO NOTHING;

INSERT INTO data_integrity_snapshots(stage, metric_name, metric_value)
SELECT 'AFTER', 'v49_materials_without_supplier_links', COUNT(*)
FROM materials m
WHERE NOT EXISTS (
    SELECT 1 FROM supplier_materials sm WHERE sm.material_id = m.id
);

INSERT INTO data_integrity_snapshots(stage, metric_name, metric_value)
SELECT 'AFTER', 'v49_materials_with_single_supplier_link', COUNT(*)
FROM (
    SELECT sm.material_id, COUNT(*) AS c
    FROM supplier_materials sm
    GROUP BY sm.material_id
    HAVING COUNT(*) = 1
) t;
