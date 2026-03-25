"""
Seed script for Retrevr Insurance Platform.
Populates the database with realistic demo data.

Usage:
    python backend/scripts/seed.py
"""

from __future__ import annotations

import asyncio
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Allow running from repo root or backend/
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text

from app.core.database import async_session
from app.models import (
    AgentConfig,
    AgentKnowledgeBase,
    AgentStatus,
    AuditLog,
    Call,
    CallDirection,
    CallSentiment,
    CallStatus,
    CallSummary,
    CallTranscript,
    Campaign,
    CampaignLead,
    CampaignResult,
    CampaignStatus,
    CampaignType,
    DocumentStatus,
    InsuranceType,
    KnowledgeDocument,
    Lead,
    LeadInteraction,
    LeadQualification,
    LeadStatus,
    Organization,
    User,
    UserRole,
    VoiceAgent,
    VoiceEnum,
)
from app.services.auth import hash_password

# ---------------------------------------------------------------------------
# Deterministic RNG for reproducibility
# ---------------------------------------------------------------------------
rng = random.Random(42)

NOW = datetime.now(timezone.utc)


def days_ago(n: float) -> datetime:
    return NOW - timedelta(days=n)


def rand_date(start_days: int, end_days: int) -> datetime:
    return NOW - timedelta(days=rng.uniform(end_days, start_days))


# ---------------------------------------------------------------------------
# Transcript library
# ---------------------------------------------------------------------------

AUTO_QUOTE_TRANSCRIPT = """Agent: Thank you for calling Premier Insurance Group. My name is Alex, how can I help you today?
Customer: Hi Alex, I'm looking to get a quote for auto insurance. My current policy is up for renewal next month.
Agent: Absolutely, I'd be happy to help you with that. Can I get your name and zip code to start?
Customer: Sure, it's Michael Torres, and I'm in 90210.
Agent: Great, Michael. What year, make, and model is your vehicle?
Customer: It's a 2021 Toyota Camry LE.
Agent: Perfect. And how many miles do you drive per year approximately?
Customer: Around 12,000 miles a year.
Agent: Any accidents or violations in the past three years?
Customer: No, clean record.
Agent: Excellent. Based on what you've told me, I can offer you a comprehensive policy at $142 per month or $1,620 annually with a 5% discount. This includes $100,000/$300,000 liability, collision with $500 deductible, and comprehensive.
Customer: That sounds competitive. My current rate is $155 a month so that's a saving.
Agent: Yes, and we also offer a multi-policy discount if you bundle with home insurance. That could bring it down another 8%.
Customer: I'll definitely think about that. Can you email me the quote?
Agent: Of course. I'll send that over to michael.torres@email.com. Is there anything else I can help you with today?
Customer: No that's perfect, thank you Alex.
Agent: My pleasure Michael. Have a great day!"""

HOME_RENEWAL_TRANSCRIPT = """Agent: Good morning, Coastal Coverage Co, this is Sarah speaking.
Customer: Hi Sarah, I got a renewal notice for my homeowners policy and I have some questions.
Agent: Of course, what's your policy number?
Customer: It's HO-447821.
Agent: I've pulled that up. I see your renewal is in 30 days. Your premium is going up about 12% this year due to increased replacement costs in your area. What questions did you have?
Customer: Yeah, that's quite a jump. Is there anything I can do to lower it?
Agent: A few options — you could raise your deductible from $1,000 to $2,500, which would save you around $180 a year. We also have a loyalty discount if you've been claims-free for 5 years, and I see you qualify for that — that's another $95 off.
Customer: What about adding a security system? I installed one last year.
Agent: Absolutely, that qualifies for a 5% discount. Let me recalculate — with the deductible change, loyalty discount, and security system, your new annual premium would be $2,340 instead of $2,780.
Customer: That's much better! How do I submit proof of the security system?
Agent: You can upload a photo of the monitoring certificate on our customer portal or email it to documents@coastalcoverage.com.
Customer: Perfect, I'll do that today. Thanks Sarah.
Agent: Great, and I'll note on your account that documentation is incoming. Your policy renews automatically unless you hear from us otherwise. Is there anything else?
Customer: No, I'm good. Thank you!"""

LIFE_INSURANCE_TRANSCRIPT = """Agent: LifeGuard Financial, this is James. How can I help you?
Customer: Hi, I'm calling because I recently had a baby and I think it's time to look at life insurance.
Agent: Congratulations! That's a great reason to get started. I'd be happy to walk you through some options. Can I ask your age and whether you smoke?
Customer: I'm 32, non-smoker.
Agent: Perfect profile for great rates. Are you thinking term life or permanent coverage?
Customer: I honestly don't know the difference. Can you explain?
Agent: Sure. Term life covers you for a set period — say 20 or 30 years — at a fixed premium. It's the most affordable and popular choice for young families protecting income replacement. Permanent life, like whole or universal life, builds cash value and covers you for life but costs significantly more.
Customer: With a new baby, I think term makes more sense financially.
Agent: Most financial advisors agree for your situation. For a healthy 32-year-old non-smoker, a $500,000 20-year term policy would run around $28 to $35 a month depending on the exact underwriting.
Customer: That's much less than I expected. What's the process?
Agent: You'd fill out an application, we do a brief medical questionnaire, and sometimes a paramedic exam at no cost to you. Whole process takes 2-4 weeks typically.
Customer: Okay, let's start the application. What do you need from me?"""

CLAIMS_TRANSCRIPT = """Agent: AutoShield Claims, this is Jennifer. How can I help you?
Customer: Hi, I need to file a claim. I was in an accident this morning.
Agent: I'm so sorry to hear that. Are you safe? Is anyone injured?
Customer: Yes, everyone is okay. Just vehicle damage.
Agent: Good to hear. Let me get your information. Policy number?
Customer: AS-7734521.
Agent: I've got you, David Chen. Can you tell me what happened?
Customer: I was stopped at a red light and someone rear-ended me. The other driver admitted fault and we exchanged info.
Agent: Great that you got their information. Do you have their insurance carrier and policy number?
Customer: Yes, it's State Farm, policy number SF-8829201.
Agent: Perfect. I'm opening a claim now. Your claim number is AS-2024-088741. Do you need a rental car while yours is being repaired?
Customer: Yes please, that would be really helpful.
Agent: I'll authorize that through Enterprise — you can pick up a car today. For repairs, I'll send you our preferred shop list. You have the right to use any licensed shop, but our preferred shops guarantee the work.
Customer: Okay, what happens next?
Agent: An adjuster will contact you within 24 hours to schedule a damage inspection. The whole process typically takes 7-10 business days for straightforward rear-end cases where fault is clear. I'll email you the claim confirmation and next steps.
Customer: Thank you Jennifer, you've been very helpful.
Agent: Of course David. I hope your car gets fixed quickly. Is there anything else you need?"""

RENEWAL_OUTBOUND_TRANSCRIPT = """Agent: Hi, is this Patricia Williams?
Customer: Yes, who's calling?
Agent: This is Mike from AutoShield Direct. I'm calling because your auto policy renews in 45 days and I wanted to touch base to see if your coverage still meets your needs.
Customer: Oh yes, I've been meaning to call actually. I got a new car in January.
Agent: Perfect timing then! What vehicle did you get?
Customer: A 2023 Honda CR-V, replaced the old Civic I had.
Agent: Great choice. The CR-V will affect your premium slightly — it's a higher value vehicle. Let me pull up your account. I see you currently have liability-only on the old policy. For a 2023 vehicle, you'll definitely want to add collision and comprehensive to protect your investment.
Customer: Yeah, I knew I needed to update. What would that cost?
Agent: With your excellent driving record — no claims, no violations — full coverage on the CR-V would be around $167 a month. That replaces the $89 liability-only. The difference is $78 but you're protecting a $32,000 vehicle.
Customer: That makes sense. Can we make that change today?
Agent: Absolutely, I can update your policy right now and the coverage is effective immediately. I just need to confirm a few details on the new vehicle."""

COMMERCIAL_INQUIRY_TRANSCRIPT = """Agent: Summit Commercial Insurance, this is Robert.
Customer: Hi Robert, I own a small landscaping business and I'm looking to get commercial coverage. My current carrier just raised my rates significantly.
Agent: I'd be happy to help. What type of coverage are you currently carrying?
Customer: General liability and commercial auto. I have 4 trucks and a crew of 8.
Agent: What's your annual revenue roughly, if you don't mind me asking?
Customer: Around $850,000.
Agent: Okay, and have you had any claims in the past 3 years?
Customer: One small one — a client's fence got damaged by one of our mowers. About $3,200.
Agent: That's fairly minor. For a landscaping operation your size, you're looking at roughly $4,800 to $6,200 annually for GL and commercial auto combined, depending on your equipment values and exact driving radius. The fence claim won't hurt you much — it's below the threshold that triggers significant rate action.
Customer: That's better than what I'm paying now. What about workers comp?
Agent: That's separate and based on your payroll. For landscaping crews, the classification rate is higher than office work given the physical risk — typically around $7-9 per $100 of payroll.
Customer: Can you pull together a full package quote for me?
Agent: Absolutely. Let me get a few more details and I'll have a comprehensive proposal to you by end of day tomorrow."""

HEALTH_INQUIRY_TRANSCRIPT = """Agent: LifeGuard Financial benefits line, this is Amanda.
Customer: Hi, I just started a new job and I need to enroll in health insurance. This is my first time doing this and I'm a bit confused.
Agent: No worries at all, I'm here to help. Your employer should have given you an enrollment packet. Do you have that in front of you?
Customer: Yes, I have it here.
Agent: Great. There are typically two or three plan options. The key differences are premium — what you pay each month — versus deductible and out-of-pocket costs. Are you generally healthy, see the doctor infrequently?
Customer: Pretty healthy yeah, maybe one or two doctor visits a year.
Agent: Then you might consider the High Deductible Health Plan with the HSA option. You pay less per month, and the HSA lets you set aside pre-tax money for medical expenses.
Customer: What's an HSA?
Agent: Health Savings Account — it's like a bank account just for medical costs, and your employer may contribute to it. The money rolls over year to year and you can invest it.
Customer: That sounds good. How much does the HDHP cost?
Agent: Looking at the plan documents, it's $187 a month with a $1,500 deductible. The next plan up is $312 a month with a $500 deductible. If you're healthy, the HDHP saves you $1,500 a year in premiums even if you hit your deductible.
Customer: That math makes sense. I'll go with the HDHP. How do I enroll?"""

FLOOD_INQUIRY_TRANSCRIPT = """Agent: Coastal Coverage Co, flood insurance division, this is Linda.
Customer: Hi Linda, I just bought a house in a flood zone and my mortgage company is requiring flood insurance. I have no idea how this works.
Agent: Welcome to the neighborhood! Flood insurance is separate from homeowners — it's typically through the National Flood Insurance Program, though we also offer private flood policies that can be more competitive.
Customer: What's the difference?
Agent: NFIP is government-backed, maximum coverage $250,000 on the structure. Private flood can cover higher values and often has better rates in some zones, and it can include loss of use coverage that NFIP doesn't.
Customer: My house is worth about $380,000.
Agent: Then you'd want private flood to cover the full replacement value. What flood zone is the property?
Customer: The disclosure says AE.
Agent: AE is a high-risk zone, but there's a big difference in rates depending on your base flood elevation relative to your first floor. Do you have an elevation certificate?
Customer: The seller gave us one, yes.
Agent: That will determine the rate significantly. If your first floor is 1-2 feet above the base flood elevation, your annual premium might be $800-1,200. If it's at or below, it could be $2,000-4,000.
Customer: I'll dig that certificate out. Should I email it to you?"""

POLICY_CHANGE_TRANSCRIPT = """Agent: Premier Insurance Group, how can I help?
Customer: Hi, I need to add my teenage son to my auto policy. He just got his license.
Agent: Congratulations to him! Adding a teen driver will change your premium — they're statistically higher risk. What's your current policy number?
Customer: PIG-334792.
Agent: I've got it. You currently have 2 vehicles — a 2019 Accord and a 2017 Pilot. How old is your son?
Customer: He just turned 16.
Agent: And which vehicle will he primarily drive?
Customer: The Accord, the smaller one.
Agent: Okay. Adding a 16-year-old male driver will increase your 6-month premium by approximately $380-420, so about $63-70 per month more.
Customer: That's a lot. Are there any discounts for students?
Agent: Yes — good student discount applies if he maintains a B average or better, that's 10%. We also have a driver training discount if he completed an approved course. And our telematics app tracks driving behavior — safe drivers can get up to 25% back.
Customer: He did take the driver's ed course at school. And his GPA is 3.4 so he'd qualify for good student. What would that bring it down to?
Agent: With those two discounts plus the telematics sign-up, you're looking at $38-42 a month additional rather than $63-70. And if his driving scores well, that telematics discount grows over time.
Customer: That's much more reasonable. Let's add him."""

NO_ANSWER_TRANSCRIPT = ""  # For no-answer calls

VOICEMAIL_TRANSCRIPT = """Agent: Hi, this message is for Sandra Peterson. This is Carlos calling from AutoShield Direct regarding your upcoming policy renewal. Your renewal date is April 15th and we have some great options to discuss that could save you money. Please call us back at your convenience at 1-800-555-0199. Thank you and have a great day."""

# Transcript pool by call type
TRANSCRIPTS = {
    "auto_quote": AUTO_QUOTE_TRANSCRIPT,
    "home_renewal": HOME_RENEWAL_TRANSCRIPT,
    "life_inquiry": LIFE_INSURANCE_TRANSCRIPT,
    "claims": CLAIMS_TRANSCRIPT,
    "renewal_outbound": RENEWAL_OUTBOUND_TRANSCRIPT,
    "commercial_inquiry": COMMERCIAL_INQUIRY_TRANSCRIPT,
    "health_inquiry": HEALTH_INQUIRY_TRANSCRIPT,
    "flood_inquiry": FLOOD_INQUIRY_TRANSCRIPT,
    "policy_change": POLICY_CHANGE_TRANSCRIPT,
    "voicemail": VOICEMAIL_TRANSCRIPT,
}


# ---------------------------------------------------------------------------
# Name pools
# ---------------------------------------------------------------------------

FIRST_NAMES = [
    "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
    "William", "Barbara", "David", "Elizabeth", "Richard", "Susan", "Joseph", "Jessica",
    "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Lisa", "Daniel", "Nancy",
    "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
    "Steven", "Dorothy", "Paul", "Kimberly", "Andrew", "Emily", "Joshua", "Donna",
    "Kenneth", "Michelle", "Kevin", "Carol", "Brian", "Amanda", "George", "Melissa",
    "Timothy", "Deborah", "Ronald", "Stephanie", "Edward", "Rebecca", "Jason", "Sharon",
    "Jeffrey", "Laura", "Ryan", "Cynthia", "Jacob", "Kathleen", "Gary", "Angela",
    "Nicholas", "Shirley", "Eric", "Amy", "Jonathan", "Anna", "Stephen", "Helen",
    "Larry", "Brenda", "Justin", "Pamela", "Scott", "Emma", "Brandon", "Nicole",
    "Benjamin", "Ruth", "Samuel", "Katherine", "Gregory", "Christine", "Frank", "Samantha",
    "Raymond", "Debra", "Alexander", "Rachel", "Patrick", "Carolyn", "Jack", "Janet",
    "Dennis", "Maria", "Jerry", "Catherine", "Tyler", "Heather", "Aaron", "Diane",
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
    "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
    "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
    "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
    "Carter", "Roberts", "Turner", "Phillips", "Evans", "Collins", "Edwards", "Stewart",
    "Morris", "Morales", "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan",
    "Cooper", "Peterson", "Bailey", "Reed", "Kelly", "Howard", "Ramos", "Kim", "Cox",
    "Ward", "Richardson", "Watson", "Brooks", "Chavez", "Wood", "James", "Bennett",
    "Gray", "Mendoza", "Ruiz", "Hughes", "Price", "Alvarez", "Castillo", "Sanders",
    "Patel", "Myers", "Long", "Ross", "Foster", "Jimenez", "Powell", "Jenkins",
    "Perry", "Russell", "Sullivan", "Bell", "Coleman", "Butler", "Henderson", "Barnes",
]


def rand_name() -> tuple[str, str]:
    return rng.choice(FIRST_NAMES), rng.choice(LAST_NAMES)


def rand_phone() -> str:
    area = rng.randint(200, 999)
    exchange = rng.randint(200, 999)
    number = rng.randint(1000, 9999)
    return f"+1{area}{exchange}{number}"


def rand_email(first: str, last: str, domain: str = None) -> str:
    domains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "aol.com"]
    d = domain or rng.choice(domains)
    sep = rng.choice([".", "_", ""])
    num = "" if rng.random() > 0.3 else str(rng.randint(1, 99))
    return f"{first.lower()}{sep}{last.lower()}{num}@{d}"


# ---------------------------------------------------------------------------
# Organization definitions
# ---------------------------------------------------------------------------

ORG_DEFS = [
    {
        "name": "Premier Insurance Group",
        "slug": "premier-insurance",
        "tier": "enterprise",
        "story": "high_performer",
        "lines": [InsuranceType.auto, InsuranceType.home, InsuranceType.life],
        "voice": VoiceEnum.nova,
        "agent_name": "Alexis",
        "persona": "Professional, confident, and warm insurance advisor for Premier Insurance Group.",
        "system_prompt": (
            "You are Alexis, an AI voice agent for Premier Insurance Group. "
            "You help customers with auto, home, and life insurance quotes, renewals, and policy changes. "
            "Be professional yet friendly. Always confirm the customer's name and policy number before discussing account details. "
            "Highlight multi-policy discounts. If a customer seems ready to buy, guide them through the next steps."
        ),
    },
    {
        "name": "Coastal Coverage Co",
        "slug": "coastal-coverage",
        "tier": "professional",
        "story": "growing",
        "lines": [InsuranceType.home, InsuranceType.umbrella],
        "voice": VoiceEnum.shimmer,
        "agent_name": "Marina",
        "persona": "Knowledgeable and reassuring coastal property specialist.",
        "system_prompt": (
            "You are Marina, an AI agent for Coastal Coverage Co, specialists in home, flood, and umbrella insurance. "
            "You have deep knowledge of coastal property risks including flood zones, hurricane ratings, and coastal construction. "
            "Be empathetic and educational — many customers are first-time flood insurance buyers. "
            "Always mention the importance of flood coverage in coastal areas."
        ),
    },
    {
        "name": "AutoShield Direct",
        "slug": "autoshield-direct",
        "tier": "professional",
        "story": "high_volume",
        "lines": [InsuranceType.auto],
        "voice": VoiceEnum.alloy,
        "agent_name": "Rex",
        "persona": "Fast, efficient, and direct auto insurance specialist.",
        "system_prompt": (
            "You are Rex, a high-efficiency AI agent for AutoShield Direct, specializing in auto insurance. "
            "You handle high call volume so be concise and direct while remaining helpful. "
            "Quickly identify what the customer needs: new quote, policy change, claim, or billing. "
            "Emphasize competitive pricing and the simplicity of AutoShield's digital-first experience."
        ),
    },
    {
        "name": "LifeGuard Financial",
        "slug": "lifeguard-financial",
        "tier": "enterprise",
        "story": "specialist",
        "lines": [InsuranceType.life, InsuranceType.health],
        "voice": VoiceEnum.echo,
        "agent_name": "Jamie",
        "persona": "Compassionate and knowledgeable life and health insurance advisor.",
        "system_prompt": (
            "You are Jamie, an AI advisor for LifeGuard Financial, specializing in life and health insurance. "
            "Be compassionate and patient — these are sensitive financial products. "
            "Educate customers on the difference between term and permanent life insurance. "
            "For health insurance, explain deductibles, copays, and network considerations clearly. "
            "Never rush a customer and always offer to follow up in writing."
        ),
    },
    {
        "name": "Summit Commercial",
        "slug": "summit-commercial",
        "tier": "starter",
        "story": "niche",
        "lines": [InsuranceType.commercial],
        "voice": VoiceEnum.onyx,
        "agent_name": "Victor",
        "persona": "Experienced and detail-oriented commercial lines specialist.",
        "system_prompt": (
            "You are Victor, a commercial insurance specialist for Summit Commercial. "
            "You work with small to mid-size businesses on general liability, commercial auto, workers comp, and BOP policies. "
            "Always ask about business type, annual revenue, number of employees, and claims history early in the conversation. "
            "Be thorough — commercial clients need comprehensive coverage analysis."
        ),
    },
]

# ---------------------------------------------------------------------------
# Campaign name pools
# ---------------------------------------------------------------------------

CAMPAIGN_NAMES = {
    InsuranceType.auto: [
        "Spring Auto Renewal Outreach",
        "New Driver Acquisition Q1",
        "Bundle & Save - Auto + Home",
        "Lapsed Policy Win-Back",
        "Teen Driver Add-On Push",
        "EV Insurance Launch Campaign",
    ],
    InsuranceType.home: [
        "Homeowner Renewal Follow-Up",
        "Flood Zone Awareness Drive",
        "New Homebuyer Outreach",
        "Bundle Discount Campaign",
        "Post-Storm Claims Follow-Up",
    ],
    InsuranceType.life: [
        "New Parent Life Insurance",
        "Term Life Awareness Q2",
        "Estate Planning Package",
        "Group Life Employer Pitch",
        "Age 40+ Whole Life Intro",
    ],
    InsuranceType.commercial: [
        "Small Business BOP Outreach",
        "Contractor Liability Push",
        "Restaurant Owner Campaign",
        "Workers Comp Renewal",
        "Commercial Auto Fleet Drive",
    ],
    InsuranceType.health: [
        "Open Enrollment Q4",
        "HDHP + HSA Education",
        "Small Group Health Pitch",
        "Dental Vision Add-On",
    ],
}

# ---------------------------------------------------------------------------
# Knowledge document templates
# ---------------------------------------------------------------------------

KNOWLEDGE_DOCS = [
    ("Auto Insurance Policy Guide", "text/markdown", "auto"),
    ("Homeowners Coverage Explained", "text/markdown", "home"),
    ("Life Insurance: Term vs Permanent", "text/markdown", "life"),
    ("Commercial General Liability Overview", "text/markdown", "commercial"),
    ("Flood Insurance NFIP vs Private", "text/markdown", "flood"),
    ("Claims Filing Process & FAQ", "text/markdown", "claims"),
    ("Multi-Policy Discount Programs", "text/markdown", "discounts"),
]


# ---------------------------------------------------------------------------
# Call scenario builder
# ---------------------------------------------------------------------------

CALL_SCENARIOS = [
    # (transcript_key, insurance_type, direction, status, sentiment_range, duration_range)
    ("auto_quote", InsuranceType.auto, CallDirection.inbound, CallStatus.completed, (0.6, 0.95), (180, 600)),
    ("home_renewal", InsuranceType.home, CallDirection.inbound, CallStatus.completed, (0.5, 0.9), (300, 720)),
    ("life_inquiry", InsuranceType.life, CallDirection.inbound, CallStatus.completed, (0.7, 0.95), (480, 900)),
    ("claims", InsuranceType.auto, CallDirection.inbound, CallStatus.completed, (0.3, 0.75), (300, 600)),
    ("renewal_outbound", InsuranceType.auto, CallDirection.outbound, CallStatus.completed, (0.5, 0.9), (240, 540)),
    ("commercial_inquiry", InsuranceType.commercial, CallDirection.inbound, CallStatus.completed, (0.55, 0.9), (420, 900)),
    ("health_inquiry", InsuranceType.health, CallDirection.inbound, CallStatus.completed, (0.6, 0.95), (360, 720)),
    ("flood_inquiry", InsuranceType.home, CallDirection.inbound, CallStatus.completed, (0.5, 0.85), (300, 660)),
    ("policy_change", InsuranceType.auto, CallDirection.inbound, CallStatus.completed, (0.55, 0.9), (300, 600)),
    ("voicemail", InsuranceType.auto, CallDirection.outbound, CallStatus.completed, (0.4, 0.7), (30, 60)),
    (None, InsuranceType.auto, CallDirection.outbound, CallStatus.no_answer, (0.3, 0.5), (5, 20)),
    (None, InsuranceType.auto, CallDirection.outbound, CallStatus.busy, (0.3, 0.5), (5, 15)),
]


def build_summary_for(transcript_key: str | None) -> tuple[str, list, list] | None:
    """Return (summary_text, key_points, next_actions) or None."""
    if not transcript_key or transcript_key not in TRANSCRIPTS or not TRANSCRIPTS[transcript_key]:
        return None

    summaries = {
        "auto_quote": (
            "Customer Michael Torres called to get an auto insurance quote for a 2021 Toyota Camry. "
            "Agent offered comprehensive coverage at $142/month ($1,620/year), saving customer $13/month vs current carrier. "
            "Customer expressed interest and requested email quote.",
            ["Customer has clean driving record", "Offered $142/month comprehensive coverage", "5% annual payment discount presented", "8% bundle discount available for home policy"],
            ["Send email quote to customer", "Follow up in 48 hours if no response", "Discuss home insurance bundle opportunity"],
        ),
        "home_renewal": (
            "Customer called about homeowners renewal with 12% premium increase. "
            "Agent identified multiple discounts including deductible increase, loyalty discount, and security system discount. "
            "Net result: premium reduced from $2,780 to $2,340 annually.",
            ["Customer has security system installed recently", "Qualifies for 5-year claims-free loyalty discount", "Willing to raise deductible to $2,500"],
            ["Customer to upload security system certificate", "Confirm renewal in 30 days", "Review additional coverage gaps"],
        ),
        "life_inquiry": (
            "New parent inquired about life insurance options for the first time. "
            "Agent educated customer on term vs permanent life insurance. "
            "Customer chose to pursue 20-year term, $500K policy at approximately $28-35/month.",
            ["First-time life insurance buyer", "32-year-old non-smoker with new baby", "$500K 20-year term selected", "Estimated premium $28-35/month"],
            ["Start application process", "Schedule paramedic exam", "Follow up on application status in 5 days"],
        ),
        "claims": (
            "Customer David Chen filed auto claim for rear-end collision with no injuries. "
            "Other driver admitted fault. Claim number AS-2024-088741 opened. Rental car authorized.",
            ["Rear-end collision, other driver at fault", "No injuries reported", "Claim number: AS-2024-088741", "Rental car authorized at Enterprise"],
            ["Adjuster to contact customer within 24 hours", "Customer to provide preferred repair shop", "Monitor third-party claim with State Farm"],
        ),
        "renewal_outbound": (
            "Outbound renewal call led to discovery that customer purchased new 2023 Honda CR-V. "
            "Old liability-only policy updated to full coverage. Customer enrolled in telematics program.",
            ["Customer has new 2023 Honda CR-V replacing old Civic", "Upgraded from liability-only to full coverage", "Enrolled in telematics for potential 25% discount"],
            ["Process vehicle update in system", "Send telematics app setup instructions", "Set reminder for 90-day telematics review"],
        ),
        "commercial_inquiry": (
            "Small landscaping business owner ($850K revenue, 4 trucks, 8 crew) shopping for commercial coverage. "
            "One prior claim ($3,200 fence damage). Agent quoted $4,800-$6,200 for GL + commercial auto plus workers comp.",
            ["Landscaping business, AE zone risk class", "1 prior claim below $5K threshold", "$850K annual revenue", "Needs GL, commercial auto, and workers comp"],
            ["Prepare comprehensive commercial package quote by EOD tomorrow", "Request loss runs from prior carrier", "Quote workers comp separately based on payroll"],
        ),
        "health_inquiry": (
            "New employee called to enroll in health insurance for first time. "
            "Agent recommended HDHP with HSA based on healthy profile and infrequent doctor visits. "
            "Customer chose HDHP at $187/month with $1,500 deductible.",
            ["First-time health insurance enrollee", "Generally healthy, 1-2 visits per year", "Employer may contribute to HSA", "HDHP saves $1,500/year in premiums vs next plan"],
            ["Process enrollment for HDHP plan", "Email HSA contribution info", "Confirm enrollment deadline"],
        ),
        "flood_inquiry": (
            "New homeowner in AE flood zone required to get flood insurance by mortgage company. "
            "Agent explained NFIP vs private flood options. House value $380K exceeds NFIP $250K limit. "
            "Customer to provide elevation certificate for accurate rating.",
            ["Property in AE high-risk flood zone", "House value $380K exceeds NFIP maximum", "Private flood policy recommended", "Elevation certificate obtained from seller"],
            ["Review elevation certificate when provided", "Prepare private flood quote", "Explain coverage options to customer in detail"],
        ),
        "policy_change": (
            "Customer adding 16-year-old son to auto policy. Agent applied good student and driver training discounts. "
            "Customer enrolled in telematics. Net additional premium $38-42/month instead of $63-70.",
            ["16-year-old male driver added to Accord", "Good student discount (GPA 3.4)", "Driver training discount applied", "Telematics enrollment reduces rate further"],
            ["Process teen driver addition", "Send telematics app link to customer", "Set calendar reminder for good student verification"],
        ),
        "voicemail": (
            "Outbound voicemail left for policy renewal. Customer not reached.",
            ["Left voicemail regarding upcoming renewal", "Provided callback number"],
            ["Attempt callback in 2 business days", "Try alternate contact time if no response"],
        ),
    }
    return summaries.get(transcript_key)


# ---------------------------------------------------------------------------
# Main seed function
# ---------------------------------------------------------------------------

async def seed():
    print("Starting seed...")

    async with async_session() as session:
        # Clear existing data in correct order
        print("Clearing existing data...")
        for tbl in [
            "audit_logs", "api_keys", "integrations", "notification_rules", "notifications",
            "ab_test_results", "ab_test_variants", "ab_tests",
            "document_embeddings", "agent_knowledge_bases", "knowledge_documents",
            "campaign_results", "campaign_leads", "campaigns",
            "call_sentiments", "call_summaries", "call_transcripts", "call_recordings",
            "calls", "lead_qualifications", "lead_interactions", "leads",
            "agent_configs", "voice_agents", "refresh_tokens", "users", "organizations",
        ]:
            await session.execute(text(f"DELETE FROM {tbl}"))
        await session.commit()
        print("Existing data cleared.")

        # -----------------------------------------------------------------------
        # 1. Organizations + Users + Voice Agents
        # -----------------------------------------------------------------------
        orgs: list[Organization] = []
        org_users: dict[str, list[User]] = {}
        org_voice_agents: dict[str, list[VoiceAgent]] = {}

        # Super-admin user (first org)
        superadmin_org_idx = 0

        for idx, org_def in enumerate(ORG_DEFS):
            org = Organization(
                name=org_def["name"],
                slug=org_def["slug"],
                subscription_tier=org_def["tier"],
                is_active=True,
                settings={
                    "primary_lines": [l.value for l in org_def["lines"]],
                    "story": org_def["story"],
                    "timezone": "America/New_York",
                },
            )
            session.add(org)
            await session.flush()
            orgs.append(org)
            print(f"  Created org: {org.name}")

            # Users
            users_for_org: list[User] = []
            num_users = rng.randint(2, 4)
            roles = [UserRole.admin, UserRole.agent, UserRole.agent, UserRole.viewer]
            rng.shuffle(roles)

            if idx == superadmin_org_idx:
                # Add a super-admin
                sa_first, sa_last = "Super", "Admin"
                sa = User(
                    organization_id=org.id,
                    email="superadmin@retrevr.demo",
                    hashed_password=hash_password("SuperAdmin123!"),
                    first_name=sa_first,
                    last_name=sa_last,
                    role=UserRole.superadmin,
                    is_active=True,
                )
                session.add(sa)
                users_for_org.append(sa)

            for i in range(num_users):
                first, last = rand_name()
                role = roles[i % len(roles)]
                # Owner/admin for first user of each org
                if i == 0 and idx != superadmin_org_idx:
                    role = UserRole.admin
                slug_domain = org_def["slug"].replace("-", "") + ".com"
                user = User(
                    organization_id=org.id,
                    email=rand_email(first, last, slug_domain if rng.random() > 0.5 else None),
                    hashed_password=hash_password("Demo1234!"),
                    first_name=first,
                    last_name=last,
                    role=role,
                    is_active=True,
                )
                session.add(user)
                users_for_org.append(user)

            await session.flush()
            org_users[str(org.id)] = users_for_org

            # Voice Agent
            va = VoiceAgent(
                organization_id=org.id,
                name=org_def["agent_name"],
                persona=org_def["persona"],
                system_prompt=org_def["system_prompt"],
                voice=org_def["voice"],
                status=AgentStatus.active,
                vad_config={"mode": "server_vad", "threshold": 0.5, "prefix_padding_ms": 300, "silence_duration_ms": 800},
            )
            session.add(va)
            await session.flush()

            # Agent config
            config = AgentConfig(
                voice_agent_id=va.id,
                key="insurance_lines",
                value={"lines": [l.value for l in org_def["lines"]], "max_call_duration": 900},
            )
            session.add(config)
            org_voice_agents[str(org.id)] = [va]
            print(f"    Created voice agent: {va.name}")

        await session.commit()
        print("Organizations, users, and voice agents created.")

        # -----------------------------------------------------------------------
        # 2. Knowledge Documents
        # -----------------------------------------------------------------------
        print("Creating knowledge documents...")
        for org in orgs:
            # Each org gets 2-4 knowledge docs
            docs = rng.sample(KNOWLEDGE_DOCS, k=rng.randint(2, 4))
            for title, file_type, doc_type in docs:
                doc = KnowledgeDocument(
                    organization_id=org.id,
                    title=title,
                    file_path=f"docs/{org.slug}/{doc_type}_guide.md",
                    file_type=file_type,
                    status=DocumentStatus.ready,
                )
                session.add(doc)
                await session.flush()

                # Link to voice agent
                va = org_voice_agents[str(org.id)][0]
                akb = AgentKnowledgeBase(
                    voice_agent_id=va.id,
                    knowledge_document_id=doc.id,
                )
                session.add(akb)

        await session.commit()
        print("Knowledge documents created.")

        # -----------------------------------------------------------------------
        # 3. Leads
        # -----------------------------------------------------------------------
        print("Creating leads...")
        org_leads: dict[str, list[Lead]] = {}

        # Distribution: Premier gets more leads (high performer)
        lead_counts = {
            "premier-insurance": 30,
            "coastal-coverage": 18,
            "autoshield-direct": 25,
            "lifeguard-financial": 15,
            "summit-commercial": 10,
        }

        status_weights = {
            "premier-insurance": {  # High performer: more bound, fewer lost
                LeadStatus.new: 0.10,
                LeadStatus.contacted: 0.15,
                LeadStatus.qualified: 0.20,
                LeadStatus.quoted: 0.25,
                LeadStatus.bound: 0.22,
                LeadStatus.lost: 0.08,
            },
            "coastal-coverage": {  # Growing: more new/contacted, growing pipeline
                LeadStatus.new: 0.20,
                LeadStatus.contacted: 0.25,
                LeadStatus.qualified: 0.20,
                LeadStatus.quoted: 0.15,
                LeadStatus.bound: 0.12,
                LeadStatus.lost: 0.08,
            },
            "autoshield-direct": {  # High volume, moderate conversion
                LeadStatus.new: 0.15,
                LeadStatus.contacted: 0.20,
                LeadStatus.qualified: 0.20,
                LeadStatus.quoted: 0.20,
                LeadStatus.bound: 0.15,
                LeadStatus.lost: 0.10,
            },
            "default": {
                LeadStatus.new: 0.15,
                LeadStatus.contacted: 0.20,
                LeadStatus.qualified: 0.20,
                LeadStatus.quoted: 0.20,
                LeadStatus.bound: 0.15,
                LeadStatus.lost: 0.10,
            },
        }

        for org in orgs:
            n = lead_counts.get(org.slug, 10)
            org_def = next(d for d in ORG_DEFS if d["slug"] == org.slug)
            weights_map = status_weights.get(org.slug, status_weights["default"])
            statuses = list(weights_map.keys())
            weights = list(weights_map.values())

            leads_for_org: list[Lead] = []
            for _ in range(n):
                first, last = rand_name()
                ins_type = rng.choice(org_def["lines"])
                status = rng.choices(statuses, weights=weights)[0]

                # Propensity score correlates with status
                base_propensity = {
                    LeadStatus.new: (0.2, 0.5),
                    LeadStatus.contacted: (0.3, 0.6),
                    LeadStatus.qualified: (0.5, 0.75),
                    LeadStatus.quoted: (0.6, 0.85),
                    LeadStatus.bound: (0.8, 0.99),
                    LeadStatus.lost: (0.1, 0.4),
                }
                lo, hi = base_propensity[status]
                propensity = round(rng.uniform(lo, hi), 3)

                created = rand_date(90, 0)

                lead = Lead(
                    organization_id=org.id,
                    first_name=first,
                    last_name=last,
                    email=rand_email(first, last) if rng.random() > 0.1 else None,
                    phone=rand_phone() if rng.random() > 0.05 else None,
                    insurance_type=ins_type.value,
                    status=status.value,
                    propensity_score=propensity,
                    metadata_={
                        "source": rng.choice(["web_form", "referral", "outbound_campaign", "walk_in", "social_media"]),
                        "zip_code": str(rng.randint(10000, 99999)),
                    },
                    created_at=created,
                    updated_at=created + timedelta(days=rng.uniform(0, 10)),
                )
                session.add(lead)
                leads_for_org.append(lead)

            await session.flush()
            org_leads[str(org.id)] = leads_for_org
            print(f"    {org.name}: {n} leads")

        await session.commit()
        print("Leads created.")

        # -----------------------------------------------------------------------
        # 4. Calls (200+)
        # -----------------------------------------------------------------------
        print("Creating calls...")
        org_calls: dict[str, list[Call]] = {}

        # Call count by org story
        call_counts = {
            "premier-insurance": 70,   # High performer, high volume
            "autoshield-direct": 65,   # High volume specialty
            "coastal-coverage": 30,    # Growing
            "lifeguard-financial": 25, # Specialist, lower volume
            "summit-commercial": 15,   # Niche, smaller
        }

        for org in orgs:
            n_calls = call_counts.get(org.slug, 20)
            va = org_voice_agents[str(org.id)][0]
            leads = org_leads.get(str(org.id), [])
            calls_for_org: list[Call] = []

            for i in range(n_calls):
                scenario = rng.choice(CALL_SCENARIOS)
                trans_key, ins_type, direction, status, sent_range, dur_range = scenario

                # Only assign lead if lead list non-empty
                lead = rng.choice(leads) if leads and rng.random() > 0.2 else None
                duration = int(rng.uniform(*dur_range)) if status == CallStatus.completed else rng.randint(5, 30)
                created = rand_date(90, 0)

                call = Call(
                    organization_id=org.id,
                    agent_id=va.id,
                    lead_id=lead.id if lead else None,
                    direction=direction.value,
                    status=status.value,
                    duration=duration,
                    phone_from=rand_phone(),
                    phone_to=rand_phone(),
                    twilio_sid=f"CA{uuid.uuid4().hex[:32]}",
                    sentiment_score=round(rng.uniform(*sent_range), 3) if status == CallStatus.completed else None,
                    created_at=created,
                    updated_at=created + timedelta(seconds=duration + rng.randint(0, 300)),
                )
                session.add(call)
                await session.flush()
                calls_for_org.append(call)

                # Transcript
                if trans_key and TRANSCRIPTS.get(trans_key):
                    transcript_text = TRANSCRIPTS[trans_key]
                    ct = CallTranscript(
                        call_id=call.id,
                        transcript=transcript_text,
                        language="en-US",
                        created_at=created + timedelta(seconds=duration + 30),
                        updated_at=created + timedelta(seconds=duration + 60),
                    )
                    session.add(ct)

                    # Summary
                    summary_data = build_summary_for(trans_key)
                    if summary_data:
                        summary_text, key_points, next_actions = summary_data
                        cs = CallSummary(
                            call_id=call.id,
                            summary=summary_text,
                            key_points=key_points,
                            next_actions=next_actions,
                            created_at=created + timedelta(seconds=duration + 90),
                            updated_at=created + timedelta(seconds=duration + 120),
                        )
                        session.add(cs)

                # Sentiment
                if status == CallStatus.completed:
                    score = call.sentiment_score
                    if score and score >= 0.7:
                        cust_sent = "positive"
                        agent_sent = "positive"
                    elif score and score >= 0.45:
                        cust_sent = "neutral"
                        agent_sent = "positive"
                    else:
                        cust_sent = "negative"
                        agent_sent = "neutral"

                    sent = CallSentiment(
                        call_id=call.id,
                        overall_score=score,
                        customer_sentiment=cust_sent,
                        agent_sentiment=agent_sent,
                        details={
                            "tone": cust_sent,
                            "frustration_detected": score is not None and score < 0.4,
                            "purchase_intent": score is not None and score > 0.75,
                        },
                        created_at=created + timedelta(seconds=duration + 120),
                        updated_at=created + timedelta(seconds=duration + 150),
                    )
                    session.add(sent)

            await session.flush()
            org_calls[str(org.id)] = calls_for_org
            print(f"    {org.name}: {n_calls} calls")

        await session.commit()
        print("Calls created.")

        # -----------------------------------------------------------------------
        # 5. Campaigns
        # -----------------------------------------------------------------------
        print("Creating campaigns...")

        campaign_counts = {
            "premier-insurance": 8,
            "coastal-coverage": 6,
            "autoshield-direct": 7,
            "lifeguard-financial": 5,
            "summit-commercial": 5,
        }

        for org in orgs:
            org_def = next(d for d in ORG_DEFS if d["slug"] == org.slug)
            n_campaigns = campaign_counts.get(org.slug, 5)
            leads = org_leads.get(str(org.id), [])

            # Build pool of campaign names from org's lines
            name_pool: list[str] = []
            for line in org_def["lines"]:
                name_pool.extend(CAMPAIGN_NAMES.get(line, []))
            if not name_pool:
                name_pool = ["Q1 Outreach Campaign", "Renewal Drive", "New Business Push", "Win-Back Campaign"]
            rng.shuffle(name_pool)

            statuses_seq = [
                CampaignStatus.completed,
                CampaignStatus.completed,
                CampaignStatus.active,
                CampaignStatus.active,
                CampaignStatus.paused,
                CampaignStatus.draft,
                CampaignStatus.draft,
                CampaignStatus.active,
            ]

            for i in range(n_campaigns):
                c_name = name_pool[i % len(name_pool)]
                c_status = statuses_seq[i % len(statuses_seq)]
                c_type = rng.choice([CampaignType.outbound_call, CampaignType.multi_channel])
                created = rand_date(90, 30) if c_status == CampaignStatus.completed else rand_date(30, 0)

                campaign = Campaign(
                    organization_id=org.id,
                    name=c_name,
                    type=c_type.value,
                    status=c_status.value,
                    config={
                        "target_insurance_type": rng.choice([l.value for l in org_def["lines"]]),
                        "daily_call_limit": rng.randint(20, 100),
                        "calling_hours": {"start": "09:00", "end": "20:00", "timezone": "America/New_York"},
                    },
                    created_at=created,
                    updated_at=created + timedelta(days=rng.uniform(0, 20)),
                )
                session.add(campaign)
                await session.flush()

                # Assign leads to campaign
                if leads:
                    n_campaign_leads = rng.randint(3, min(12, len(leads)))
                    campaign_lead_pool = rng.sample(leads, k=n_campaign_leads)
                    for lead in campaign_lead_pool:
                        cl_status = rng.choice(["pending", "called", "converted", "skipped"])
                        cl = CampaignLead(
                            campaign_id=campaign.id,
                            lead_id=lead.id,
                            status=cl_status,
                            created_at=created + timedelta(days=rng.uniform(0, 5)),
                            updated_at=created + timedelta(days=rng.uniform(5, 20)),
                        )
                        session.add(cl)

                # Campaign results for completed/active
                if c_status in (CampaignStatus.completed, CampaignStatus.active):
                    total_calls = rng.randint(40, 200) if c_status == CampaignStatus.completed else rng.randint(10, 80)
                    connected = int(total_calls * rng.uniform(0.45, 0.70))
                    qualified = int(connected * rng.uniform(0.25, 0.50))
                    converted = int(qualified * rng.uniform(0.20, 0.45))
                    cr = CampaignResult(
                        campaign_id=campaign.id,
                        metrics={
                            "total_calls": total_calls,
                            "connected_calls": connected,
                            "qualified_leads": qualified,
                            "conversions": converted,
                            "conversion_rate": round(converted / max(total_calls, 1), 4),
                            "avg_call_duration_sec": rng.randint(180, 480),
                            "revenue_generated": converted * rng.randint(800, 3500),
                        },
                        created_at=created + timedelta(days=rng.uniform(1, 10)),
                        updated_at=created + timedelta(days=rng.uniform(10, 30)),
                    )
                    session.add(cr)

            print(f"    {org.name}: {n_campaigns} campaigns")

        await session.commit()
        print("Campaigns created.")

        # -----------------------------------------------------------------------
        # Summary
        # -----------------------------------------------------------------------
        total_calls = sum(len(v) for v in org_calls.values())
        total_leads = sum(len(v) for v in org_leads.values())
        print(
            f"\nSeed complete!\n"
            f"  Organizations : {len(orgs)}\n"
            f"  Leads         : {total_leads}\n"
            f"  Calls         : {total_calls}\n"
        )


if __name__ == "__main__":
    asyncio.run(seed())
