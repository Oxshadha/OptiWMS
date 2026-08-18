-- Seeds the default warehouse SOPs the assistant answers from.
--
-- The sops table ships empty, and ai-agent/ingest.py builds its vector store from
--   SELECT ... FROM sops WHERE status = 'active'
-- so with no rows the assistant has no procedural knowledge at all. Seeding here keeps the
-- content versioned with the schema rather than living in someone's local database.
--
-- Numbered V97 because V92 through V96 are taken; the file arrived as V92, which collides with
-- V92__putaway_task_handling_units.sql and would stop Flyway from booting.
--
-- Idempotent by design: the ids are fixed, so a re-run refreshes wording and version in place
-- instead of failing on the primary key. Editing an SOP therefore means editing this file.

-- =========================================================================
-- OPTIWMS SOPS: CONSOLIDATED INSERT SCRIPT
-- =========================================================================

-- 1. Forklift Operation and Safety
INSERT INTO sops (id, title, category, content, version, status, created_by, applicable_roles, created_at, updated_at)
VALUES (
    '69abb9de-4e27-42ab-ac4b-80a132abb9d8', 
    'SOP - Forklift Operation and Safety', 
    'general', 
    '1. Operator Qualifications: Only individuals who are properly trained and possess a valid license are permitted to operate forklifts.
2. PPE and Safety Clothing: Operators must wear a hard hat, safety shoes, and hi-visibility jackets. Clothing must be well-fitted; loose clothing is a safety hazard. Hands must be clean of grease before operating controls to ensure a firm grip.
3. Pre-Operation Inspection: Perform routine checks on brakes, steering, controls, warning devices, mast, and tires. Report any damages to management immediately. Do not operate equipment requiring repair. Plan the "journey''s end" for every load before picking it up.
4. Starting and Mounting: Use hand grabs and steps to seat yourself correctly. Adjust the seat and mirrors so all controls are within easy reach. Fasten the safety belt and ensure all body parts are inside the cabin before starting.
5. Environmental Awareness: Follow all site rules and drive only in designated roadways. Observe floor loading limits and clearance height signs (check load, mast, and overhead guard). Stay a safe distance from dock edges and ramps. Use bridge plates only if they support the total weight.
6. Speed and Maneuvering: Adhere to speed limits. Take corners slowly to prevent tipping. Make all stops and direction changes gradually.
7. Hazard Avoidance: Avoid bumps, uneven ground, and slippery surfaces. Use the horn at corners, doorways, and around people. Maintain safe stopping distances from other trucks.
8. Load Stability and Security: Tilt the load back and keep forks low while transporting to increase stability. Ensure loads are correctly positioned across both forks. Do not move unstable loads; use ropes or bindings if required.
9. Visibility and Ramp Safety: Operate in reverse if it improves visibility (except on ramps). Use a lookout helper if visibility is poor. Move forward when going up ramps and in reverse when going down ramps while carrying loads. Never turn or attempt to load/unload on a ramp.
10. Capacity and Load Distribution: Never exceed the forklift''s rated capacity. Overloading can raise rear tires and cause tipping. Do not use the tips of the forks to lever or push a load. Both forks must be fully under the load. Never lift with one fork. Use only undamaged, high-quality pallets.
11. Mast Safety: No one is permitted to stand or walk under a raised load. Keep hands and feet clear of the mast cross members.
12. Refueling, Charging, and Shutdown: Refuel/charge only in designated, well-ventilated areas with the engine off. At shift end, park in authorized areas with forks lowered to the floor and the park brake applied. Turn the engine off and remove the key. Never leave a forklift running unattended.', 
    '1.01.0', 
    'active', 
    'System Administrator', 
    'Forklift Operator', 
    '2026-06-22 18:55:11.824661', 
    '2026-06-22 18:55:11.824661'
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    category = EXCLUDED.category,
    content = EXCLUDED.content,
    version = EXCLUDED.version,
    status = EXCLUDED.status,
    applicable_roles = EXCLUDED.applicable_roles,
    updated_at = now();
-- 2. Powered Pallet Truck (PPT) Operations
INSERT INTO sops (id, title, category, content, version, status, created_by, applicable_roles, created_at, updated_at)
VALUES (
    '7a8bc0ef-5f38-43cd-bd4c-91b243bcc0e9', 
    'SOP - Powered Pallet Truck (PPT) Operations', 
    'general', 
    '1. Operator Qualifications: Only individuals with proper training and qualifications are permitted to operate powered pallet trucks.
2. PPE and Safety Clothing: Operators must wear a hard hat, safety shoes, and hi-visibility jackets. Clothing must be well-fitted to avoid getting caught in machinery. Hands must be free of grease before operating controls to prevent accidents.
3. Pre-Use Equipment Inspection: Perform routine checks on brakes, steering, controls, and warning devices. Report damages to management immediately; do not operate if repairs are needed. Plan the "journey''s end" of a load before picking it up to ensure safe positioning.
4. Surrounding Environment & Site Rules: Follow all work site guidelines and stay within designated machinery roadways. Observe floor loading limits and clearance height signs. Maintain a safe distance from dock edges and ramps. Use bridge plates only if they support the combined weight of the truck and load.
5. Safe Speed and Hazard Avoidance: Stay within speed limits; take turns slowly and stop gradually. Avoid bumps, slippery surfaces, and loose objects on the ground. Use the horn at corners and doorways to alert pedestrians. Maintain safe stopping distances from other vehicles.
6. Load Stability and Security: Inspect loads for stability and damage before moving. Ensure loads are evenly positioned across both forks. Do not move unstable loads; use securing ropes or bindings if necessary.
7. Visibility and Ramp Safety: Operate in reverse to improve visibility, except when moving up ramps. Use a lookout helper if visibility is poor. When on ramps: move forward when going up and reverse when going down. Never turn or attempt to load/unload while on a ramp.
8. Capacity and Loading Standards: Never exceed the truck''s rated capacity. Overloading can cause tipping. Forks must be fully under the load. Never lift with a single fork. Use only undamaged, high-quality pallets.
9. Refueling, Charging, and Shutdown: Charge or refuel only in designated, well-ventilated areas with the power off. At the end of the shift, park in authorized areas with forks fully lowered. Turn the truck off and remove the key. Never leave the truck unattended while powered.', 
    '1.01.0', 
    'active', 
    'System Administrator', 
    'PPT Operator', 
    '2026-06-22 18:55:11.824661', 
    '2026-06-22 18:55:11.824661'
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    category = EXCLUDED.category,
    content = EXCLUDED.content,
    version = EXCLUDED.version,
    status = EXCLUDED.status,
    applicable_roles = EXCLUDED.applicable_roles,
    updated_at = now();
-- 3. Stacker Operation Instructions
INSERT INTO sops (id, title, category, content, version, status, created_by, applicable_roles, created_at, updated_at)
VALUES (
    '8b9cd1fe-2a49-44de-ae5d-02c354cdd1f0', 
    'SOP - Stacker Operation Instructions', 
    'general', 
    '1. Operator Qualifications: Operators must be qualified. Only individuals who have been properly trained should operate the stacker.
2. PPE and Clothing Requirements: Appropriate safety work wear must be worn: hard hat, safety shoes, and hi-visibility jackets. Clothing must be reasonably fitted; loose clothing can get caught in machinery. Do not operate controls with greasy hands to prevent sliding and accidents.
3. Pre-Operation Equipment Check: Conduct a routine check of brakes, steering, controls, and warning devices before use. Notify management of any damages; do not operate equipment requiring repair. Consider the "journey''s end" of a load before picking it up to ensure it can be stacked conveniently.
4. Environmental Awareness: Follow all site rules and drive only in designated roadways. Observe floor loading limits and clearance heights. Keep a safe distance from the edges of loading docks or ramps to prevent tipping. Do not operate on bridge plates unless they support the combined weight of stacker and load.
5. Safe Speed and Maneuvering: Never exceed the speed limit. Take corners slowly to minimize tipping risks. Make direction changes and stops gradually.
6. Hazard Avoidance: Avoid bumps, uneven ground, slippery surfaces, and loose objects. Use the horn at corners, doorways, and around pedestrians. Maintain a safe distance from other trucks and ensure enough stopping space.
7. Load Stability and Security: Check loads for damage and stability before moving. Ensure loads are correctly positioned across both forks. Use ropes or bindings to secure loads if required.
8. Visibility and Mast Safety: Operate in reverse if it improves visibility (except on ramps). Use a lookout helper if visibility is poor. Keep clear of the mast; never stand or walk under a raised load. Keep hands and feet clear of cross members to avoid serious injury.
9. Driving on Ramps: Move forward when going up ramps and in reverse when going down ramps while carrying loads. Do not turn or attempt to load/unload while on a ramp.
10. Capacity and Distribution: Never exceed the stacker''s rated capacity. Overloading causes tipping. Ensure both forks are fully under the load. Do not lift with one fork. Use only undamaged pallets that can withstand the load weight.
11. Refueling, Charging, and Shutdown: Charge/refuel only in designated, well-ventilated areas with the power switched off. At shift end, park in authorized areas with forks fully lowered. Turn the power off and remove the key. Never leave equipment unattended while powered.', 
    '1.01.0', 
    'active', 
    'System Administrator', 
    'Stacker Operator', 
    '2026-06-22 18:55:11.824661', 
    '2026-06-22 18:55:11.824661'
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    category = EXCLUDED.category,
    content = EXCLUDED.content,
    version = EXCLUDED.version,
    status = EXCLUDED.status,
    applicable_roles = EXCLUDED.applicable_roles,
    updated_at = now();
-- 4. Empty Pallet Purchasing Instructions
INSERT INTO sops (id, title, category, content, version, status, created_by, applicable_roles, created_at, updated_at)
VALUES (
    '9c0de2af-3b50-55ef-df6e-13d465dee2a1', 
    'SOP - Empty Pallet Purchasing Instructions', 
    'general', 
    '1. Engineering store takes quotation from suppliers, evaluate suppliers/quotation and selects a supplier annually.
2. Logistics executive receives pallet requirements from respective plants (Material warehouse/Diva plants).
3. Logistics executive checks in & out of empty pallets and reconcile in & out quantities.
4. If there is quantity to be received from plants (FGWH/JKL), check whether the plants can release the required quantity immediately.
5. If plants are unable to release the required quantity, Assistant manager or Head of logistics should be informed regarding the requirement and get approval for purchasing new pallets.', 
    '1.01.0', 
    'active', 
    'System Administrator', 
    'Logistics Executive / Management', 
    '2026-06-22 18:55:11.824661', 
    '2026-06-22 18:55:11.824661'
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    category = EXCLUDED.category,
    content = EXCLUDED.content,
    version = EXCLUDED.version,
    status = EXCLUDED.status,
    applicable_roles = EXCLUDED.applicable_roles,
    updated_at = now();
-- 5. Material Unloading Procedures
INSERT INTO sops (id, title, category, content, version, status, created_by, applicable_roles, created_at, updated_at)
VALUES (
    '0d1ef3be-4a61-56fa-ea7f-24e576eff3b2', 
    'SOP - Material Unloading Procedures', 
    'general', 
    '* Wearing safety shoes and hi-visibility jacket is must.
* Unloading crew should wear appropriate PPEs according to materials to be unloaded (Heavy material: gloves/helmets; Material with dust: masks/goggles; Hazardous chemical: gloves/masks/goggles).
* Appropriate equipment should be used according to materials to be unloaded (Drums: Drum handler/forklift; Heavy material: Forklift/Powered pallet trucks).
* Ensure materials stored in vehicle are in good condition.
* For raw materials, maximum accepted weight on a pallet is 1500kg.
* For packing materials, maximum accepted weight on a pallet is 1000kg.
* Stack different materials on separate pallets.
* Material should be stacked according to standards (stacking height data sheet/printed on packages).
* Once stacking is done, material should be wrapped with tape or strapping or stretch films.', 
    '1.01.0', 
    'active', 
    'System Administrator', 
    'Unloading Crew', 
    '2026-06-22 18:55:11.824661', 
    '2026-06-22 18:55:11.824661'
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    category = EXCLUDED.category,
    content = EXCLUDED.content,
    version = EXCLUDED.version,
    status = EXCLUDED.status,
    applicable_roles = EXCLUDED.applicable_roles,
    updated_at = now();
-- 6. Warehouse Safekeeping Procedure
INSERT INTO sops (id, title, category, content, version, status, created_by, applicable_roles, created_at, updated_at)
VALUES (
    '1e2fa4cf-5b72-27ba-fa8a-35f687fab4c3', 
    'SOP - Warehouse Safekeeping Procedure', 
    'general', 
    '1. Carry out inspection once in three months as per check list. (F 15.4.1)
2. Enter observations and maintain records.
3. Identify weakness and take steps to improve.', 
    '1.01.0', 
    'active', 
    'System Administrator', 
    'Warehouse Inspector', 
    '2026-06-22 18:55:11.824661', 
    '2026-06-22 18:55:11.824661'
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    category = EXCLUDED.category,
    content = EXCLUDED.content,
    version = EXCLUDED.version,
    status = EXCLUDED.status,
    applicable_roles = EXCLUDED.applicable_roles,
    updated_at = now();
-- 7. Vehicle Inspection Record
INSERT INTO sops (id, title, category, content, version, status, created_by, applicable_roles, created_at, updated_at)
VALUES (
    '2f3ba5da-0a83-08ba-fa9b-46a798fbb5d4', 
    'SOP - Vehicle Inspection Record', 
    'general', 
    'Evaluation Criteria:
1. Good General Cleanliness (Body / Roof / Floor)
2. Low Dust Level Inside the Vehicle
3. No Oil and Grease Patches
4. No Insect / Pest Infestation
5. Not susceptible to Weather Damage
6. No Adverse Odour
7. No Oil Spillages
8. Good Physical Condition of Vehicle
9. Vehicle is Fully Covered
10. Other specific warehouse requirements

Role Responsibilities:
- Evaluation done by: Authorized Personnel
- Prepared & Reviewed By: Management Representative
- Approved By: Head of Quality', 
    '1.01.0', 
    'active', 
    'System Administrator', 
    'Authorized Personnel / Quality Team', 
    '2026-06-22 18:55:11.824661', 
    '2026-06-22 18:55:11.824661'
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    category = EXCLUDED.category,
    content = EXCLUDED.content,
    version = EXCLUDED.version,
    status = EXCLUDED.status,
    applicable_roles = EXCLUDED.applicable_roles,
    updated_at = now();
-- 8. Conducting Cycle Counts
INSERT INTO sops (id, title, category, content, version, status, created_by, applicable_roles, created_at, updated_at)
VALUES (
    '3b4fa6ea-1a94-19ba-bf0a-57f809faa6e5', 
    'SOP - Conducting Cycle Counts', 
    'general', 
    '1. Cycle counts should be conducted quarterly.
2. In charge of raw material, packing materials and engineering stores run and downloads stock reports from the SAP system and prepare material data sheet based on material category.
3. In charges prepare teams according to the material categories and assign people to the teams accordingly.
4. In charges provide relevant material data sheets to teams.
5. Teams should count and record physical quantities of relevant materials on material data sheet.
6. All the physically counted quantities are entered into excel sheet and get variances with system quantities.
7. Materials with variances should be re-counted to check whether anything has been missed.
8. If material variances cannot be resolved at the moment, material should be moved to cycle count shortage location (2047) through the system till the issue is solved.', 
    '1.01.0', 
    'active', 
    'System Administrator', 
    'Store In-Charges / Cycle Count Teams', 
    '2026-06-22 18:55:11.824661', 
    '2026-06-22 18:55:11.824661'
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    category = EXCLUDED.category,
    content = EXCLUDED.content,
    version = EXCLUDED.version,
    status = EXCLUDED.status,
    applicable_roles = EXCLUDED.applicable_roles,
    updated_at = now();
