"""Insurance rate tables and adjustment factors."""

# Auto Insurance Rate Tables
AUTO_BASE_RATES = {
    # age_bracket: annual_base_premium
    "16-25": 2400,
    "26-35": 1600,
    "36-45": 1400,
    "46-55": 1350,
    "56-65": 1500,
    "66+": 1800,
}

AUTO_DRIVING_RECORD_FACTORS = {
    "clean": 1.0,
    "minor_violations": 1.25,
    "major_violations": 1.75,
    "dui": 2.50,
}

AUTO_VEHICLE_AGE_FACTORS = {
    "0-2": 1.15,   # New car
    "3-5": 1.0,
    "6-10": 0.85,
    "11+": 0.70,
}

AUTO_COVERAGE_FACTORS = {
    "liability_only": 0.60,
    "standard": 1.0,
    "full": 1.30,
    "premium": 1.50,
}

AUTO_DEDUCTIBLE_FACTORS = {
    250: 1.20,
    500: 1.0,
    1000: 0.85,
    2000: 0.70,
}

# Home Insurance Rate Tables
HOME_BASE_RATE_PER_1000 = 3.50  # per $1,000 of dwelling coverage

HOME_CONSTRUCTION_FACTORS = {
    "frame": 1.0,
    "masonry": 0.90,
    "fire_resistive": 0.80,
    "superior": 0.75,
}

HOME_AGE_FACTORS = {
    "0-5": 0.90,
    "6-15": 1.0,
    "16-30": 1.15,
    "31-50": 1.30,
    "51+": 1.50,
}

HOME_CLAIMS_FACTORS = {
    0: 1.0,
    1: 1.20,
    2: 1.45,
    3: 1.75,
}

HOME_DEDUCTIBLE_FACTORS = {
    500: 1.15,
    1000: 1.0,
    2500: 0.85,
    5000: 0.70,
    10000: 0.55,
}

# Life Insurance Rate Tables (per $1,000 of coverage, annual)
LIFE_BASE_RATES = {
    # (age_bracket, gender): rate per $1,000
    ("20-29", "male"): 0.95,
    ("20-29", "female"): 0.80,
    ("30-39", "male"): 1.15,
    ("30-39", "female"): 0.95,
    ("40-49", "male"): 2.10,
    ("40-49", "female"): 1.75,
    ("50-59", "male"): 5.20,
    ("50-59", "female"): 3.80,
    ("60-69", "male"): 12.50,
    ("60-69", "female"): 8.90,
    ("70+", "male"): 28.00,
    ("70+", "female"): 20.00,
}

LIFE_TOBACCO_FACTOR = 2.0
LIFE_NO_TOBACCO_FACTOR = 1.0

LIFE_HEALTH_CLASS_FACTORS = {
    "preferred_plus": 0.75,
    "preferred": 0.90,
    "standard_plus": 1.0,
    "standard": 1.15,
    "substandard": 1.75,
}

LIFE_TERM_FACTORS = {
    10: 0.80,
    15: 0.90,
    20: 1.0,
    25: 1.15,
    30: 1.30,
}

# Bundle discount
MULTI_LINE_DISCOUNT = 0.10  # 10% discount per additional line

RATE_TABLE_VERSION = "2026-Q1-v1"
