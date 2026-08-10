"""User-facing names for the project-operational simulation catalog.

Codes and IDs remain immutable because forecasts, inventory and BOM rows use
them as keys. Only display descriptions are replaced with coherent consumer-
care terminology informed by the supplied warehouse material references.
"""

from __future__ import annotations

import pandas as pd


FINISHED_GOOD_NAMES = [
    "CleanWave Fresh Laundry Liquid",
    "HomeBright Mineral Surface Cream",
    "FreshHome Pine Floor Cleaner",
    "FreshHome Aloe Mint Surface Cleaner",
    "HomeBright Heavy-Duty Kitchen Degreaser",
    "CleanWave Oxygen-Action Laundry Detergent",
    "FreshHome Citrus Pine Multi-Surface Cleaner",
    "FreshHome Active Bathroom Cleaner",
    "HomeBright Aloe Citrus Dishwash Liquid",
    "HomeBright Lavender Dishwash Gel",
    "HomeBright Lavender Scouring Cream",
    "HomeBright Fragrance-Free Dishwash Concentrate",
    "CleanWave Oxygen Stain Remover",
    "HomeBright Mineral Cleaning Cream",
    "CleanWave Antibacterial Fabric Wash",
    "CleanWave Citrus Soil-Release Detergent",
    "CleanWave Rose & Jasmine Laundry Booster",
    "HomeBright Citrus Neem Kitchen Spray",
    "CleanWave Lavender Fabric Wash",
    "FreshHome Antibacterial Pine Cleaner",
    "FreshHome Herbal Surface Sanitiser",
    "HomeBright Citrus Bicarbonate Cleaner",
    "CleanWave Lemongrass Chlorine Laundry Cleaner",
    "HomeBright Citrus Herbal Dishwash Liquid",
]

RAW_MATERIAL_NAMES = [
    "Purified Water",
    "Sodium Laureth Sulfate",
    "Cocamidopropyl Betaine",
    "Glycerine",
    "Sodium Chloride",
    "Citric Acid",
    "Sodium Hydroxide Solution",
    "Preservative Blend",
    "Fresh Citrus Fragrance",
    "Floral Fragrance",
    "Herbal Fragrance",
    "Ocean Fresh Fragrance",
    "Blue Colourant",
    "Green Colourant",
    "Pink Colourant",
    "Yellow Colourant",
    "EDTA Chelating Agent",
    "Xanthan Gum",
    "Cellulose Thickener",
    "Sodium Benzoate",
    "Potassium Sorbate",
    "Lactic Acid",
    "Aloe Vera Extract",
    "Neem Extract",
    "Tea Tree Extract",
    "Coconut-Derived Surfactant",
    "Decyl Glucoside",
    "Lauryl Glucoside",
    "Sodium Coco Sulfate",
    "Amine Oxide Surfactant",
    "Linear Alkylbenzene Sulfonate",
    "Alpha Olefin Sulfonate",
    "Nonionic Surfactant Blend",
    "Vegetable Soap Base",
    "Foam Booster",
    "Pearlising Agent",
    "Conditioning Polymer",
    "Moisturising Complex",
    "Panthenol",
    "Vitamin E Acetate",
    "Silicone Emulsion",
    "Anti-Redeposition Polymer",
    "Optical Brightener",
    "Laundry Enzyme Blend",
    "Soil Release Polymer",
    "Fabric Softening Agent",
    "Anti-Foam Emulsion",
    "Corrosion Inhibitor",
    "Sodium Carbonate",
    "Sodium Bicarbonate",
    "Sodium Sulfate",
    "Zeolite Builder",
    "Sodium Silicate",
    "Oxygen Bleach",
    "Bleach Activator",
    "Hypochlorite Solution",
    "Hydrogen Peroxide",
    "Isopropyl Alcohol",
    "Ethyl Alcohol",
    "Propylene Glycol",
    "Sorbitol",
    "Urea",
    "Talcum Powder",
    "Calcium Carbonate",
    "Silica Thickener",
    "Corn Starch Binder",
    "Polymer Opacifier",
    "Titanium Dioxide",
    "Perfume Solubiliser",
    "Hydrotrope",
    "pH Buffer Blend",
    "Water Softening Agent",
    "Antibacterial Active",
    "Antifungal Active",
    "Deodorising Active",
    "Degreasing Solvent",
    "Citrus Terpene",
    "Pine Oil",
    "Eucalyptus Oil",
    "Lavender Oil",
    "Lemongrass Oil",
    "Rose Fragrance Compound",
    "Jasmine Fragrance Compound",
    "Herbal Fragrance Compound",
    "Mint Fragrance Compound",
    "Marine Fragrance Compound",
    "Colour Stabiliser",
    "UV Stabiliser",
    "Viscosity Stabiliser",
    "Formulation Processing Aid",
]

PACKAGING_MATERIAL_NAMES = [
    "PET Bottle — Format A",
    "PET Bottle — Format B",
    "HDPE Bottle — Format A",
    "HDPE Bottle — Format B",
    "HDPE Bottle — Format C",
    "Flip-Top Closure — Format A",
    "Flip-Top Closure — Format B",
    "Pump Closure",
    "Trigger-Spray Closure",
    "Tamper-Evident Closure",
    "Printed Label Set — Format A",
    "Printed Label Set — Format B",
    "Printed Label Set — Format C",
    "Printed Label Set — Format D",
    "Printed Label Set — Format E",
    "Printed Shrink Sleeve — Format A",
    "Printed Shrink Sleeve — Format B",
    "Printed Shrink Sleeve — Format C",
    "Printed Shrink Sleeve — Format D",
    "Printed Shrink Sleeve — Format E",
    "Corrugated Shipping Case — Format A",
    "Corrugated Shipping Case — Format B",
    "Corrugated Shipping Case — Format C",
    "Corrugated Shipping Case — Format D",
    "Corrugated Shipping Case — Format E",
    "Corrugated Divider Insert",
    "Batch and Expiry Ink Ribbon",
    "GS1 Barcode Label Roll",
    "Pallet Stretch-Wrap Film",
    "Pallet Identification Label",
]


def catalog_name(material_code: str) -> str | None:
    groups = {
        "FG": FINISHED_GOOD_NAMES,
        "RM": RAW_MATERIAL_NAMES,
        "PM": PACKAGING_MATERIAL_NAMES,
    }
    try:
        prefix, number = str(material_code).split("-", 1)
        return groups[prefix][int(number) - 1]
    except (KeyError, ValueError, IndexError):
        return None


def apply_catalog_names(materials: pd.DataFrame) -> pd.DataFrame:
    named = materials.copy()
    display_names = named["material_code"].map(catalog_name)
    named.loc[display_names.notna(), "description"] = display_names[display_names.notna()]
    return named
