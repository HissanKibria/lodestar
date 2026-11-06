"""Static SAT content: study plans, resources, test dates, original practice questions."""

MATH_TOPICS = ["Linear equations & inequalities", "Systems of equations", "Quadratics & polynomials",
               "Exponential & nonlinear functions", "Ratios, percentages & units", "Geometry & trigonometry",
               "Data analysis & statistics", "Advanced algebra & radicals"]
RW_TOPICS = ["Words in context", "Transitions", "Punctuation & boundaries", "Form, structure & sense",
             "Central ideas & details", "Text structure & purpose", "Inferences & evidence", "Cross-text connections"]


def _week(i, total):
    m = MATH_TOPICS[i % 8]
    r = RW_TOPICS[i % 8]
    is_last = i == total - 1
    is_review = (i + 1) % 4 == 0 and not is_last
    if is_last:
        return {"focus": "Final polish & test-day prep", "items": [
            "Take a full-length adaptive Bluebook practice test (both modules each section)",
            "Review every missed question and update your error log",
            "Re-drill your 3 weakest topics (20 min each)",
            "Prep test-day kit: admission ticket, ID, charged device with Bluebook, snacks",
            "Sleep 8+ hours two nights before"]}
    if is_review:
        return {"focus": "Checkpoint & review", "items": [
            "Take a full-length Bluebook practice test",
            "Log your score in the Score Tracker",
            "Sort every miss: concept gap / careless / timing",
            "Re-do all missed questions two days later without notes",
            "Adjust next week's plan toward your weakest topic"]}
    return {"focus": f"{m} + {r}", "items": [
        f"Math: study guide/video on {m}",
        f"Math: 20 practice questions on {m}",
        f"Reading & Writing: study guide on {r}",
        f"Reading & Writing: 20 practice questions on {r}",
        "Do one timed 32-minute module (alternate math / R&W)",
        "Update error log; re-attempt last week's misses"]}


def make_plan(pid, name, weeks, blurb, hours):
    return {"id": pid, "name": name, "weeks": weeks, "hours_per_week": hours, "blurb": blurb,
            "schedule": [dict(_week(i, weeks), week=i + 1) for i in range(weeks)]}


PLANS = [
    make_plan("sprint4", "4-week Sprint", 4, "For a retake or a student already within ~100 points of target. Targets weak spots fast.", "6-8"),
    make_plan("steady8", "8-week Steady", 8, "Balanced plan covering every tested skill once with two checkpoints. Best default.", "4-6"),
    make_plan("deep12", "12-week Deep Dive", 12, "Full content review, three checkpoints and a taper week. For large score goals.", "4-5"),
]

RESOURCES = [
    {"group": "Official practice", "title": "Bluebook (College Board)", "url": "https://bluebook.collegeboard.org", "desc": "The app you test in. Full-length adaptive practice tests with real scoring."},
    {"group": "Official practice", "title": "Official Digital SAT Prep on Khan Academy", "url": "https://www.khanacademy.org/test-prep/sat", "desc": "Free lessons and question banks aligned to the digital SAT."},
    {"group": "Official practice", "title": "SAT Suite Question Bank", "url": "https://satsuitequestionbank.collegeboard.org", "desc": "Thousands of real questions filterable by skill and difficulty."},
    {"group": "Official practice", "title": "SAT Student Guide", "url": "https://satsuite.collegeboard.org/sat/practice-preparation", "desc": "Format, timing and scoring overview from the test maker."},
    {"group": "Tools", "title": "Desmos Graphing Calculator", "url": "https://www.desmos.com/calculator", "desc": "The calculator built into Bluebook. Practice with it before test day."},
    {"group": "Tools", "title": "Error-log template (spreadsheet idea)", "url": "https://docs.google.com/", "desc": "Columns: question, topic, why missed, fix, date re-tested."},
    {"group": "Registration", "title": "Register for the SAT", "url": "https://satsuite.collegeboard.org/sat/registration", "desc": "Create a College Board account, register, print or save your admission ticket."},
    {"group": "Registration", "title": "Accommodations (SSD)", "url": "https://accommodations.collegeboard.org", "desc": "Apply through your school's SSD coordinator well ahead of registration."},
    {"group": "Registration", "title": "Score Choice & sending scores", "url": "https://satsuite.collegeboard.org/scores/send-scores", "desc": "Send scores only to schools that require them or where they help."},
    {"group": "Application", "title": "Common App", "url": "https://www.commonapp.org", "desc": "Create your account and add colleges."},
    {"group": "Application", "title": "Common App essay prompts", "url": "https://www.commonapp.org/apply/essay-prompts", "desc": "The seven personal essay prompts, 250-650 words."},
    {"group": "Application", "title": "FAFSA", "url": "https://studentaid.gov", "desc": "Federal aid application."},
    {"group": "Application", "title": "CSS Profile", "url": "https://cssprofile.collegeboard.org", "desc": "Required for institutional aid at many private colleges."},
    {"group": "Research", "title": "College Scorecard", "url": "https://collegescorecard.ed.gov", "desc": "Costs, graduation rates and earnings from the U.S. Department of Education."},
    {"group": "Research", "title": "College Navigator (NCES)", "url": "https://nces.ed.gov/collegenavigator/", "desc": "Official federal data on every U.S. college."},
]

# Typical digital SAT administration dates for the 2026-27 cycle. Students must confirm on collegeboard.org.
TEST_DATES = [
    {"date": "2026-08-22", "register_by": "2026-08-07"},
    {"date": "2026-10-03", "register_by": "2026-09-18"},
    {"date": "2026-11-07", "register_by": "2026-10-23"},
    {"date": "2026-12-05", "register_by": "2026-11-20"},
    {"date": "2027-03-13", "register_by": "2027-02-26"},
    {"date": "2027-05-01", "register_by": "2027-04-16"},
    {"date": "2027-06-05", "register_by": "2027-05-21"},
]

SECTIONS = {
    "rw": {"title": "Reading & Writing: sample set", "minutes": 8, "questions": [
        {"id": "rw1", "skill": "Transitions", "text": "Early critics dismissed the study as poorly designed. Later, three independent labs replicated its results. ______ the researcher is now widely cited in her field.",
         "choices": ["Nevertheless,", "Consequently,", "Similarly,", "Instead,"], "answer": 1,
         "why": "The replication led to her being cited, a cause-and-effect relationship, so 'Consequently' fits."},
        {"id": "rw2", "skill": "Words in context", "text": "The mayor's response to the crisis was so measured that even her critics conceded she had avoided inflaming the situation. As used in the text, 'measured' most nearly means",
         "choices": ["calculated by instrument", "restrained and deliberate", "unusually slow", "small in size"], "answer": 1,
         "why": "Avoiding 'inflaming' the situation signals a calm, controlled response."},
        {"id": "rw3", "skill": "Form, structure & sense", "text": "The collection of vintage maps, along with several rare atlases, ______ displayed in the library's east wing.",
         "choices": ["are", "is", "were", "have been"], "answer": 1,
         "why": "The subject is the singular 'collection'. The phrase 'along with...' does not make it plural."},
        {"id": "rw4", "skill": "Punctuation & boundaries", "text": "The lab ran the experiment twice______ the results matched both times.",
         "choices": ["twice,", "twice and,", "twice, and", "twice,;"], "answer": 2,
         "why": "Two independent clauses joined by 'and' need a comma before the conjunction."},
        {"id": "rw5", "skill": "Central ideas & details", "text": "Urban rooftop gardens do more than beautify cities. Studies show they lower building temperatures, absorb stormwater and give pollinators a place to forage. Yet few cities offer incentives to build them. Which choice best states the main idea?",
         "choices": ["Rooftop gardens are mainly decorative.", "Rooftop gardens offer several benefits but are rarely encouraged by city policy.", "Pollinator populations are collapsing in cities.", "Stormwater is the largest urban environmental problem."], "answer": 1,
         "why": "The passage lists benefits and then notes the lack of incentives."},
        {"id": "rw6", "skill": "Inferences & evidence", "text": "Although reviewers dismissed the novel when it was published, it has since appeared on more than two hundred university syllabi. Which inference is best supported?",
         "choices": ["Reviewers' early judgments did not predict the novel's later academic standing.", "The novel is poorly written.", "Universities rarely assign novels.", "Reviewers now praise the novel."], "answer": 0,
         "why": "Early dismissal contrasts with later widespread teaching. The other choices go beyond the text."},
    ]},
    "math": {"title": "Math: sample set", "minutes": 10, "questions": [
        {"id": "m1", "skill": "Linear equations", "text": "If 3x + 7 = 25, what is the value of x? (Enter a number.)", "type": "free", "answer": "6",
         "why": "3x = 18, so x = 6."},
        {"id": "m2", "skill": "Linear equations", "text": "A line passes through (0, 3) and (4, 11). What is its slope?",
         "choices": ["1", "2", "3", "4"], "answer": 1, "why": "(11 - 3) / (4 - 0) = 2."},
        {"id": "m3", "skill": "Quadratics", "text": "What are the zeros of f(x) = x² - 4x + 3?",
         "choices": ["-1 and -3", "1 and 3", "2 and 3", "-1 and 3"], "answer": 1, "why": "x² - 4x + 3 = (x - 1)(x - 3)."},
        {"id": "m4", "skill": "Percentages", "text": "A jacket costs $80. It is marked down 25%, then 8% sales tax is added to the sale price. What is the final price?",
         "choices": ["$64.80", "$62.40", "$66.00", "$68.40"], "answer": 0, "why": "80 × 0.75 = 60; 60 × 1.08 = 64.80."},
        {"id": "m5", "skill": "Geometry", "text": "A right triangle has legs of length 6 and 8. What is its perimeter?",
         "choices": ["14", "20", "24", "28"], "answer": 2, "why": "The hypotenuse is 10, so 6 + 8 + 10 = 24."},
        {"id": "m6", "skill": "Data analysis", "text": "The mean of five numbers is 12. A sixth number is added and the mean of all six becomes 14. What is the sixth number?",
         "choices": ["14", "20", "24", "26"], "answer": 2, "why": "Original sum 60; new sum 84; the new number is 24."},
    ]},
}
