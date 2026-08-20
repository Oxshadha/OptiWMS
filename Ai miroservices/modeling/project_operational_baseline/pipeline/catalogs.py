"""Curated operational catalog for the generated Colombo warehouse baseline.

RM descriptions are sourced from the supplied item master. Packaging specifications
that are not present in that file are explicit generated pack specifications rather
than invented source-master records.
"""

from __future__ import annotations


ALL_PERSONAL = ("SOAP", "LIQUID_WASH", "HAIR", "SKIN", "ORAL")


RM_CATALOG = (
    ("100036", "CAUSTIC SODA", "BAG", "ALKALI", ("SOAP", "HOME")),
    ("101054", "CALCIUM CARBONATE (GROUND)", "BAG", "FILLER", ("ORAL", "HOME")),
    ("100098", "SORBITOL", "DRUM", "HUMECTANT", ("SOAP", "SKIN", "ORAL")),
    ("100108", "TALCUM POWDER", "BAG", "FILLER", ("SKIN",)),
    ("100094", "SILICA 165 THICKENING", "BAG", "THICKENER", ("LIQUID_WASH", "ORAL")),
    ("101580", "SODIUM SILICATE", "IBC", "BUILDER", ("SOAP", "HOME")),
    ("100460", "GALAXY LES 70", "IBC", "SURFACTANT", ("LIQUID_WASH", "HAIR", "HOME")),
    ("100039", "EMAL 10 PHD (GALAXY 689)", "BAG", "SURFACTANT", ("SOAP", "HOME")),
    ("100714", "COCOMIDOPROPYL BETAINE", "DRUM", "SURFACTANT", ("LIQUID_WASH", "HAIR")),
    ("100050", "GLYCERINE", "IBC", "HUMECTANT", ALL_PERSONAL),
    ("100403", "VIRGIN COCONUT OIL", "DRUM", "OIL", ("SOAP", "HAIR", "SKIN")),
    ("100110", "TITANIUM DIOXIDE", "BAG", "COLORANT", ("SOAP", "SKIN", "ORAL")),
    ("100030", "CORN STARCH", "BAG", "FILLER", ("SKIN", "HOME")),
    ("100006", "ALCOHOL", "DRUM", "SOLVENT", ("LIQUID_WASH", "SKIN", "HOME")),
    ("100026", "CETYL ALCOHOL", "BAG", "EMOLLIENT", ("HAIR", "SKIN")),
    ("100105", "STEARIC ACID", "BAG", "EMOLLIENT", ("SOAP", "SKIN")),
    ("100018", "BRIQUEST ADPA", "BUCKET", "CHELATOR", ("LIQUID_WASH", "HOME")),
    ("100069", "METHYL PARABEN", "BAG", "PRESERVATIVE", ("SOAP", "HAIR", "SKIN")),
    ("100118", "TRILON BD (DISODIUM EDTA)", "BAG", "CHELATOR", ("LIQUID_WASH", "HAIR", "HOME")),
    ("100099", "SODIUM BENZOATE", "BAG", "PRESERVATIVE", ("LIQUID_WASH", "HAIR", "ORAL", "HOME")),
    ("101091", "BENZYL ALCOHOL", "DRUM", "PRESERVATIVE", ("HAIR", "SKIN")),
    ("100028", "CITRIC ACID", "BAG", "PH_ADJUSTER", ("LIQUID_WASH", "HAIR", "HOME")),
    ("100084", "PROPYL PARABEN", "BAG", "PRESERVATIVE", ("HAIR", "SKIN")),
    ("100066", "MENTHOL", "BUCKET", "ACTIVE", ("ORAL", "LIQUID_WASH")),
    ("100109", "TRI ETHANOL AMINE", "DRUM", "PH_ADJUSTER", ("LIQUID_WASH", "HAIR", "SKIN")),
    ("100120", "TWEEN 20", "DRUM", "SOLUBILIZER", ("LIQUID_WASH", "HAIR", "SKIN")),
    ("100128", "VITAMIN E", "BUCKET", "ACTIVE", ("SOAP", "HAIR", "SKIN")),
    ("100134", "ZINC OXIDE", "BAG", "ACTIVE", ("SKIN",)),
    ("101582", "LAURIC ACID", "BAG", "EMOLLIENT", ("SOAP",)),
    ("100873", "MONO PROPYLENE GLYCOL", "DRUM", "HUMECTANT", ("LIQUID_WASH", "HAIR", "SKIN", "HOME")),
    ("101083", "CMC POLYMER", "BAG", "THICKENER", ("LIQUID_WASH", "ORAL", "HOME")),
    ("101265", "ROSE WATER", "DRUM", "BOTANICAL", ("LIQUID_WASH", "SKIN")),
    ("101283", "GLUCOPON 600 CSUP", "IBC", "SURFACTANT", ("LIQUID_WASH", "HAIR", "HOME")),
    ("101285", "RHEOVIS AT 120", "BAG", "THICKENER", ("LIQUID_WASH", "HOME")),
    ("101375", "POMACE OLIVE OIL", "DRUM", "OIL", ("SOAP", "HAIR", "SKIN")),
    ("101415", "SODIUM HYDROXIDE", "BAG", "ALKALI", ("SOAP", "HOME")),
    ("101499", "SODIUM FLUORIDE", "BAG", "ACTIVE", ("ORAL",)),
    ("101500", "PHENOXY ETHANOL", "DRUM", "PRESERVATIVE", ("LIQUID_WASH", "HAIR", "SKIN")),
    ("101574", "POTASSIUM SORBATE", "BAG", "PRESERVATIVE", ("LIQUID_WASH", "HAIR", "SKIN")),
    ("101613", "SODIUM CHLORIDE - EXTRA PURE 99.5%", "BAG", "THICKENER", ("LIQUID_WASH", "HAIR", "HOME")),
    ("101697", "NIACINAMIDE", "BAG", "ACTIVE", ("SKIN",)),
    ("101832", "CARBOMER 980", "BAG", "THICKENER", ("LIQUID_WASH", "HAIR", "SKIN")),
    ("100010", "ALLANTOIN B.P", "BAG", "ACTIVE", ("SKIN", "LIQUID_WASH")),
    ("100100", "SODIUM SACCHARIN", "BAG", "ACTIVE", ("ORAL",)),
    ("101742", "PINK PETAL TOUCH - FRAGRANCE", "CAN", "FRAGRANCE", ("SOAP", "LIQUID_WASH", "SKIN")),
    ("101740", "LAVENDER OIL", "CAN", "FRAGRANCE", ("SOAP", "HAIR", "SKIN")),
    ("101812", "JOJOBA OIL", "CAN", "OIL", ("HAIR", "SKIN")),
    ("101826", "ORANGE OIL", "CAN", "FRAGRANCE", ("SOAP", "LIQUID_WASH", "HOME")),
)


# source_code, description, handling subtype, packaging role, target FG indexes
PM_CATALOG = (
    ("PACK-SPEC-001", "LDPE Face Wash Tube 100 mL Natural", "TUBE", "CONTAINER", (4,)),
    ("PACK-SPEC-002", "PET Bottle 250 mL Clear", "BOTTLE", "CONTAINER", (5, 6, 7, 8, 11, 12)),
    ("PACK-SPEC-003", "HDPE Bottle 500 mL White", "BOTTLE", "CONTAINER", (15,)),
    ("PACK-SPEC-004", "HDPE Bottle 1 L Natural", "BOTTLE", "CONTAINER", (16,)),
    ("PACK-SPEC-005", "Laminated Toothpaste Tube 120 g", "TUBE", "CONTAINER", (13, 14)),
    ("PACK-SPEC-006", "PP Soap Wrapper 100 g", "WRAPPER", "CONTAINER", (1, 2, 3)),
    ("PACK-SPEC-007", "PP Flip-Top Cap 24 mm White", "CAP", "CLOSURE", (5, 6, 7, 13, 14, 15, 16)),
    ("PACK-SPEC-008", "Lotion Pump 28 mm White", "CAP", "CLOSURE", (8, 11, 12)),
    ("PACK-SPEC-009", "PET Hair Oil Bottle 200 mL Amber", "BOTTLE", "CONTAINER", (9,)),
    ("PACK-SPEC-010", "PP Screw Cap 20 mm Black", "CAP", "CLOSURE", (9,)),
    ("PACK-SPEC-011", "PP Cream Jar 100 mL White", "JAR", "CONTAINER", (10,)),
    ("PACK-SPEC-012", "Face Wash Front Label 100 mL", "INSERT", "LABEL", (4,)),
    ("PACK-SPEC-013", "Hand Wash Front Label 250 mL", "INSERT", "LABEL", (5, 6)),
    ("PACK-SPEC-014", "Hair Care Product Front Label", "INSERT", "LABEL", (7, 8, 9)),
    ("PACK-SPEC-015", "Skin Care Product Front Label", "INSERT", "LABEL", (10, 11, 12)),
    ("PACK-SPEC-016", "Oral Care Carton 120 g", "CARTON", "LABEL", (13, 14)),
    ("PACK-SPEC-017", "Home Care Front Label 500 mL", "INSERT", "LABEL", (15,)),
    ("PACK-SPEC-018", "Home Care Front Label 1 L", "INSERT", "LABEL", (16,)),
    ("PACK-SPEC-019", "Beauty Soap Folding Carton 100 g", "CARTON", "SECONDARY", (1, 2, 3)),
    ("PACK-SPEC-020", "Face and Hand Wash Folding Carton", "CARTON", "SECONDARY", (4, 5, 6)),
    ("PACK-SPEC-021", "Hair Care Folding Carton", "CARTON", "SECONDARY", (7, 8, 9)),
    ("PACK-SPEC-022", "Skin Care Folding Carton", "CARTON", "SECONDARY", (10, 11, 12)),
    ("PACK-SPEC-023", "Oral Care Transit Case", "CORR_BOX", "SHIPPER", (13, 14)),
    ("PACK-SPEC-024", "Personal Care Transit Case", "CORR_BOX", "SHIPPER", (1, 2, 3, 4, 5, 6, 10, 11, 12)),
    ("PACK-SPEC-025", "Hair Care Transit Case", "CORR_BOX", "SHIPPER", (7, 8, 9)),
    ("PACK-SPEC-026", "Home Care Transit Case", "CORR_BOX", "SHIPPER", (15, 16)),
    ("101472", "PRINTED PE POUCH 240 mm - LIGHT PINK", "POUCH", "TRANSIT_LINER", (5,)),
    ("101471", "PRINTED PE POUCH 240 mm - LIGHT PURPLE", "POUCH", "TRANSIT_LINER", (6,)),
    ("101470", "PRINTED PE POUCH 290 mm - SEA GREEN", "POUCH", "TRANSIT_LINER", (15,)),
    ("101298", "POUCH TAPE 30 mm", "INSERT", "TRANSIT_SEAL", (5, 6, 15)),
    ("PACK-SPEC-031", "Batch and Expiry Ink Ribbon", "INNER_LINER", "CODING", tuple(range(1, 17))),
    ("PACK-SPEC-032", "Tamper-Evident Neck Band", "NECK_TAG", "TAMPER_EVIDENCE", (5, 6, 7, 8, 9, 11, 12, 15, 16)),
)


# name, family, fill kg, units/carton, pack profile
FG_CATALOG = (
    ("PureSoft Moisturising Beauty Soap 100 g", "SOAP", 0.100, 48),
    ("PureSoft Herbal Beauty Soap 100 g", "SOAP", 0.100, 48),
    ("PureSoft Sandalwood Beauty Soap 100 g", "SOAP", 0.100, 48),
    ("FreshCare Aloe Face Wash 100 mL", "LIQUID_WASH", 0.105, 24),
    ("SafeHands Antibacterial Hand Wash 250 mL", "LIQUID_WASH", 0.260, 24),
    ("SafeHands Herbal Hand Wash 250 mL", "LIQUID_WASH", 0.260, 24),
    ("SilkGlow Nourishing Shampoo 250 mL", "HAIR", 0.265, 24),
    ("SilkGlow Repair Conditioner 250 mL", "HAIR", 0.270, 24),
    ("SilkGlow Herbal Hair Oil 200 mL", "HAIR", 0.190, 24),
    ("SoftCare Daily Moisturising Cream 100 mL", "SKIN", 0.110, 24),
    ("SoftCare Body Lotion 250 mL", "SKIN", 0.265, 24),
    ("SoftCare Aloe Body Lotion 250 mL", "SKIN", 0.265, 24),
    ("FreshMint Total Care Toothpaste 120 g", "ORAL", 0.120, 48),
    ("FreshMint Herbal Toothpaste 120 g", "ORAL", 0.120, 48),
    ("CleanWave Lemon Dishwash Liquid 500 mL", "HOME", 0.520, 12),
    ("BrightHome Laundry Liquid 1 L", "HOME", 1.040, 12),
)


ROLE_WEIGHT = {
    "ALKALI": 0.16, "FILLER": 0.18, "HUMECTANT": 0.10, "THICKENER": 0.035,
    "BUILDER": 0.12, "SURFACTANT": 0.28, "OIL": 0.12, "COLORANT": 0.006,
    "SOLVENT": 0.18, "EMOLLIENT": 0.10, "CHELATOR": 0.008, "PRESERVATIVE": 0.006,
    "PH_ADJUSTER": 0.012, "ACTIVE": 0.025, "SOLUBILIZER": 0.025, "BOTANICAL": 0.05,
    "FRAGRANCE": 0.008,
}
