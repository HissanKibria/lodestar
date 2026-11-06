"""Demo data: one counsellor, one editor, two students."""
import datetime as dt
import json

from db import hash_pw, now, seed_catalog, log

DEMO_PASSWORD = "demo1234"

PRIYA_ESSAY = """The first thing I ever repaired was my grandmother's thermostat. I was eleven, and she had been living with us for a month, shivering in a house that she insisted was "perfectly fine." She never complained. She just wore her coat indoors.

I took the thermostat apart on the kitchen table, expecting to find something obvious. Instead I found a tiny coil of metal, a mercury switch, and a layer of dust older than I was. Over the next three evenings I learned that it was miscalibrated by nearly eight degrees, which meant that every time it said seventy, the house was sitting at sixty-two. Fixing it took a screwdriver and a YouTube video. Explaining it to my grandmother took considerably longer.

She speaks Tamil and very little English, and I speak a clumsy mix of both. Technical words never survive the trip between languages. So I drew diagrams. I held her hand over the vent so she could feel the warmth arrive. By the end of the week she was telling her friends on the phone that her granddaughter had "repaired the weather."

That phrase stuck with me. I had not repaired the weather, but I had learned that the point of understanding how something works is the person who gets to feel the difference. Since then I have built a robot that sorts recycling for my school cafeteria, spent two summers debugging sensors in a university lab, and become the translator at every family appointment, from the bank to the cardiologist.

Translating taught me something that engineering classes have not. A correct answer is useless if the person in front of you cannot use it. When I explain a medication schedule to my grandmother, I do not recite the label. I build her a color-coded chart and test it by asking her to teach it back to me. Every project I now start begins with the same question: who is going to feel the difference, and what do they need to understand for it to matter?

I want to study engineering because I believe the best engineers are translators too. They carry ideas across the gap between what is possible and what is usable. My grandmother's house is warm now. I would like to spend my life making that kind of fix, at a larger scale, for people who may never know what is inside the box."""

MARCUS_ESSAY = """At 5:15 every morning the Charles River is the color of gunmetal, and I am usually the last person to the dock. This is not because I am lazy. It is because for most of my sophomore year I was afraid of the boat.

Rowing is a sport that punishes individuality. In an eight, one person catching a crab, a blade stuck in the water at the wrong angle, can stop the entire boat. I had joined because my older brother rowed, and for a year I tried to be him: quiet, steady, unbothered. It did not work. I was loud and restless, and my stroke showed it.

Our coach, Ms. Adeyemi, did not tell me to be quieter. She moved me to the bow seat, the position with the best view and the least power, and told me my job was to watch. I hated it. But from the bow you can see every oar enter the water, and for the first time I understood the boat as a single instrument instead of eight people pulling.

I started noticing small things. When Daniel's catch was late, the boat leaned to starboard for exactly two strokes. When we were tired, our breathing fell out of rhythm before our blades did. I began calling quiet corrections, and the crew began to listen.

By junior year I was elected captain, which surprised nobody more than me. I still have the loud voice. I have learned when to use it and when to let a boat run silent, when eight people are breathing as one.

I want to study history and political science because I have become fascinated by how groups decide to move together, and why they sometimes fail to. A boat is a small democracy with a very short feedback loop. Cities and countries are the same experiment run slowly. I would like to spend college learning how to watch carefully before I speak, and then to speak when it counts."""


def seed(db):
    seed_catalog(db)

    def user(email, name, role, grad=None):
        h, s, i = hash_pw(DEMO_PASSWORD)
        cur = db.execute("INSERT INTO users(email,name,role,pw_hash,salt,iters,grad_year,created) VALUES(?,?,?,?,?,?,?,?)", (email, name, role, h, s, i, grad, now()))
        return cur.lastrowid

    coun = user("counsellor@demo.edu", "Dr. Maya Okafor", "counsellor")
    edit = user("editor@demo.edu", "Daniel Reyes", "editor")
    pri = user("priya@demo.edu", "Priya Raman", "student", 2027)
    mar = user("marcus@demo.edu", "Marcus Bell", "student", 2027)
    for s in (pri, mar):
        db.execute("INSERT INTO assign VALUES(?,?)", (s, coun))
    db.execute("INSERT INTO assign VALUES(?,?)", (pri, edit))
    db.execute("INSERT INTO assign VALUES(?,?)", (mar, edit))

    today = dt.date.today()
    d = lambda n: (today + dt.timedelta(days=n)).isoformat()
    ago = lambda n: (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=n, minutes=7)).strftime("%Y-%m-%dT%H:%M:%SZ")

    def prof(sid, section, data):
        db.execute("INSERT INTO profile VALUES(?,?,?,?,?)", (sid, section, json.dumps(data), now(), sid))

    # ---------------- Priya
    prof(pri, "profile", dict(first="Priya", middle="Lakshmi", last="Raman", preferred="Priya", pronouns="she/her", birthdate="2009-03-14", sex="Female",
                              email="priya@demo.edu", phone="(617) 555-0142", address1="48 Linden Street", city="Newton", state="MA", zip="02458", country="United States",
                              citizenship="U.S. citizen", languages="English, Tamil", hispanic="No", race="Asian", fee_waiver=False))
    prof(pri, "family", dict(household="Parents live together", p1_relation="Mother", p1_living="Living", p1_name="Lakshmi Raman", p1_occupation="Pharmacist", p1_education="Graduate degree",
                             p2_relation="Father", p2_living="Living", p2_name="Arun Raman", p2_occupation="Civil engineer", p2_education="Graduate degree",
                             siblings_count="1", siblings=[dict(name="Karthik Raman", age="13", education="Middle school")], first_gen="No"))
    prof(pri, "education", dict(school_name="Newton Academy", school_city="Newton", school_state="MA", school_type="Public, non-charter", entry_date="2023-09", grad_date="2027-06",
                                class_size="412", rank_type="Decile", rank="Top 10%", gpa="3.92", gpa_scale="4.0", gpa_weighted="Weighted",
                                counselor_name="Ms. Ellen Park", counselor_email="epark@newtonacademy.example", counselor_phone="(617) 555-0199", intended_major="Mechanical or biomedical engineering"))
    prof(pri, "testing", dict(test_plan="Submit scores where they help", sat_date="2026-10-03", sat_ebrw="740", sat_math="760", sat_total="1500",
                              ap=[dict(subject="AP Calculus BC", year="2026", score="5"), dict(subject="AP Physics C: Mechanics", year="2026", score="5"), dict(subject="AP Computer Science A", year="2025", score="5")]))
    prof(pri, "activities", dict(items=[
        dict(type="Robotics", position="Team Captain", org="Newton Academy Robotics (FRC Team 4120)", desc="Lead 28-member team; designed drivetrain, raised $14K in sponsorships, qualified for district championship.", grades=["10", "11", "12"], timing="All year", hours="12", weeks="40", **{"continue": True}),
        dict(type="Research", position="Summer Research Intern", org="Northeastern Biomechanics Lab", desc="Built and calibrated strain-sensor rigs for gait study; co-authored a poster presented at campus symposium.", grades=["10", "11"], timing="School break", hours="30", weeks="8", **{"continue": True}),
        dict(type="Community Service (Volunteer)", position="Family translator & tutor", org="Newton Senior Center", desc="Translate Tamil/English at medical appointments; teach seniors to use phones and telehealth weekly.", grades=["9", "10", "11", "12"], timing="School year", hours="3", weeks="40", **{"continue": True}),
        dict(type="Music: Instrumental", position="Section Leader, Violin", org="Newton Youth Orchestra", desc="Principal second violin; rehearse weekly, perform four concerts a year, mentor younger players.", grades=["9", "10", "11", "12"], timing="All year", hours="5", weeks="44", **{"continue": False}),
        dict(type="Science/Math", position="Co-founder", org="Math Circle at NA", desc="Founded peer problem-solving club; run weekly sessions for 30 students; prepared AMC 10/12 teams.", grades=["10", "11", "12"], timing="School year", hours="2", weeks="36", **{"continue": False}),
        dict(type="Dance", position="Performer", org="Bharatanatyam Academy of Boston", desc="Eleven years of classical Indian dance training; perform arangetram-level repertoire at community events.", grades=["9", "10", "11", "12"], timing="All year", hours="4", weeks="46", **{"continue": False}),
        dict(type="Work (Paid)", position="Tutor", org="Mathnasium Newton", desc="Tutor middle schoolers in pre-algebra and algebra; created custom practice sets for struggling learners.", grades=["11", "12"], timing="School year", hours="6", weeks="32", **{"continue": False}),
    ]))
    prof(pri, "honors", dict(items=[
        dict(title="AP Scholar with Distinction", grades=["11"], levels=["National"]),
        dict(title="FIRST Robotics District Finalist", grades=["11"], levels=["State/Regional"]),
        dict(title="MA State Science Fair, 2nd place Engineering", grades=["11"], levels=["State/Regional"]),
        dict(title="National Merit Commended Student", grades=["12"], levels=["National"]),
    ]))
    prof(pri, "additional", dict(text="During spring of my sophomore year our robotics team lost our lab space for six weeks due to building renovation. I organized a rotating schedule in members' garages, which is why our competition robot was built in three different locations."))
    prof(pri, "courses", dict(rows=[dict(year="9", term="Full year", name=n, level=l, grade=g, credits="1") for n, l, g in
                                    [("English 9", "Honors", "A"), ("Geometry", "Honors", "A"), ("Biology", "Honors", "A-"), ("World History", "Standard", "A"), ("Spanish II", "Standard", "A")]] +
                              [dict(year="10", term="Full year", name=n, level=l, grade=g, credits="1") for n, l, g in
                               [("English 10", "Honors", "A"), ("Algebra II / Trig", "Honors", "A"), ("Chemistry", "Honors", "A"), ("AP US History", "AP", "A-")]] +
                              [dict(year="11", term="Full year", name=n, level=l, grade=g, credits="1") for n, l, g in
                               [("AP English Language", "AP", "A-"), ("AP Calculus BC", "AP", "A"), ("AP Physics C", "AP", "A"), ("AP Computer Science A", "AP", "A")]]))

    # ---------------- Marcus
    prof(mar, "profile", dict(first="Marcus", middle="James", last="Bell", preferred="Marcus", pronouns="he/him", birthdate="2009-07-22", sex="Male",
                              email="marcus@demo.edu", phone="(617) 555-0177", address1="210 Harbor View Rd", city="Quincy", state="MA", zip="02169", country="United States",
                              citizenship="U.S. citizen", languages="English", hispanic="No", race="Black or African American", fee_waiver=False))
    prof(mar, "family", dict(household="Parents are divorced or separated", p1_relation="Mother", p1_living="Living", p1_name="Denise Bell", p1_occupation="Nurse", p1_education="Bachelor's degree",
                             siblings_count="2", siblings=[dict(name="Terrence Bell", age="20", education="College")], first_gen="No"))
    prof(mar, "education", dict(school_name="Quincy Collegiate School", school_city="Quincy", school_state="MA", school_type="Private", entry_date="2023-09", grad_date="2027-06",
                                class_size="140", rank_type="None", gpa="3.71", gpa_scale="4.0", gpa_weighted="Unweighted", counselor_name="Mr. Paul Whitaker", counselor_email="pwhitaker@quincycollegiate.example",
                                intended_major="History / Political Science"))
    prof(mar, "testing", dict(test_plan="Submit scores where they help", sat_date="2026-08-22", sat_ebrw="680", sat_math="610", sat_total="1290", ap=[dict(subject="AP US History", year="2026", score="4")]))
    prof(mar, "activities", dict(items=[
        dict(type="Athletics: Club", position="Captain, Varsity Crew", org="Quincy Collegiate Crew", desc="Elected captain; run 5:15 AM practices for 24 rowers, coordinate lineups and regatta travel; 2nd at New England Interscholastics.", grades=["10", "11", "12"], timing="All year", hours="15", weeks="42", **{"continue": True}),
        dict(type="Student Govt./Politics", position="Class Representative", org="Student Council", desc="Elected two years; led proposal that extended library hours and introduced a student mental-health day.", grades=["10", "11"], timing="School year", hours="3", weeks="30", **{"continue": False}),
        dict(type="Journalism/Publication", position="Sports Editor", org="The Collegiate Courier", desc="Write and edit weekly sports and local-history features; grew online readership 40%.", grades=["10", "11", "12"], timing="School year", hours="4", weeks="34", **{"continue": True}),
        dict(type="Community Service (Volunteer)", position="Coach's Assistant", org="Quincy Youth Rowing Clinic", desc="Teach middle schoolers to row each summer; developed beginner safety checklist adopted by the program.", grades=["11", "12"], timing="School break", hours="10", weeks="6", **{"continue": True}),
        dict(type="Work (Paid)", position="Lifeguard", org="Quincy Parks & Recreation", desc="Certified lifeguard at city pool, 20 hours each week over two summers.", grades=["10", "11"], timing="School break", hours="20", weeks="10", **{"continue": False}),
    ]))
    prof(mar, "honors", dict(items=[dict(title="New England Interscholastic Rowing 2nd Place", grades=["11"], levels=["State/Regional"]), dict(title="Scholastic Writing Awards: Silver Key", grades=["10"], levels=["State/Regional"])]))
    prof(mar, "additional", dict(text=""))
    prof(mar, "courses", dict(rows=[dict(year="9", term="Full year", name=n, level=l, grade=g, credits="1") for n, l, g in
                                    [("English 9", "Standard", "B+"), ("Algebra II", "Standard", "B"), ("Biology", "Standard", "A-"), ("World History", "Honors", "A")]] +
                              [dict(year="10", term="Full year", name=n, level=l, grade=g, credits="1") for n, l, g in
                               [("English 10", "Honors", "A-"), ("Pre-Calculus", "Standard", "B"), ("AP US History", "AP", "A-")]] +
                              [dict(year="11", term="Full year", name=n, level=l, grade=g, credits="1") for n, l, g in
                               [("AP English Language", "AP", "B+"), ("AP Government", "AP", "A")]]))

    # ---------------- Colleges
    cid = lambda n: db.execute("SELECT id,rd,early,early_type FROM catalog WHERE name LIKE ?", (n + "%",)).fetchone()

    def addcol(sid, name, rnd, status="Planned", notes="", category=None):
        c = cid(name)
        if rnd in ("ED", "EA", "REA") and c["early"] and c["early"] < today.isoformat():
            rnd = "RD"  # early deadline already passed in this demo
        dl = c["early"] if rnd in ("ED", "EA", "REA") and c["early"] else c["rd"]
        cur = db.execute("INSERT INTO student_colleges(student_id,catalog_id,name,category,round,deadline,status,notes,added) VALUES(?,?,?,?,?,?,?,?,?)",
                         (sid, c["id"], db.execute("SELECT name FROM catalog WHERE id=?", (c["id"],)).fetchone()[0], category, rnd, dl, status, notes, now()))
        return cur.lastrowid

    pc = {}
    for n, r, s, note in [("Massachusetts Institute", "EA", "In progress", "Visit in October was great. Interview scheduled."), ("Stanford", "RD", "Planned", ""),
                          ("Georgia Institute", "EA", "In progress", "Strong fit for ME. Likely safe-ish."), ("Carnegie", "RD", "Planned", ""),
                          ("University of Michigan", "EA", "In progress", ""), ("University of Illinois", "EA", "Planned", "Engineering is competitive; check direct-admit major."),
                          ("Northeastern", "EA", "Planned", "Co-op program is attractive."), ("Purdue", "EA", "Planned", "")]:
        pc[n] = addcol(pri, n, r, s, note)
    mc = {}
    for n, r, s, note in [("Georgetown", "EA", "In progress", "Interview requested."), ("University of Virginia", "ED", "Planned", "Possible ED. Talk with family."),
                          ("Boston University", "RD", "Planned", ""), ("Tufts", "RD", "Planned", ""), ("University of Wisconsin", "EA", "Planned", ""),
                          ("Ohio State", "EA", "Planned", ""), ("Pennsylvania State", "RD", "Researching", "")]:
        mc[n] = addcol(mar, n, r, s, note)

    # ---------------- Essays
    def essay(sid, kind, title, prompt, limit, content, status, college=None, by=None):
        cur = db.execute("INSERT INTO essays(student_id,kind,title,prompt,word_limit,college_id,content,status,created,updated,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                         (sid, kind, title, prompt, limit, college, content, status, ago(21), ago(1), by or sid))
        return cur.lastrowid

    P5 = "Discuss an accomplishment, event, or realization that sparked a period of personal growth and a new understanding of yourself or others."
    P1 = "Some students have a background, identity, interest, or talent that is so meaningful they believe their application would be incomplete without it. If this sounds like you, then please share your story."
    e1 = essay(pri, "personal", "Common App Personal Essay", P1, 650, PRIYA_ESSAY, "In review")
    first = PRIYA_ESSAY.split("\n\n")
    v_old = "\n\n".join(first[:3])
    db.execute("INSERT INTO essay_versions(essay_id,content,note,author_id,words,created) VALUES(?,?,?,?,?,?)", (e1, v_old, "First draft (opening)", pri, len(v_old.split()), ago(14)))
    mid = "\n\n".join(first[:5])
    db.execute("INSERT INTO essay_versions(essay_id,content,note,author_id,words,created) VALUES(?,?,?,?,?,?)", (e1, mid, "Added translating thread", pri, len(mid.split()), ago(8)))
    db.execute("INSERT INTO essay_versions(essay_id,content,note,author_id,words,created) VALUES(?,?,?,?,?,?)", (e1, PRIYA_ESSAY, "Full draft, ready for review", pri, len(PRIYA_ESSAY.split()), ago(3)))

    def anchor(eid, content, quote, author, body, parent=None, resolved=0, days=2):
        s = content.find(quote)
        cur = db.execute('INSERT INTO comments(essay_id,parent_id,author_id,start,"end",quote,body,resolved,created) VALUES(?,?,?,?,?,?,?,?,?)',
                         (eid, parent, author, s, s + len(quote), quote, body, resolved, ago(days)))
        return cur.lastrowid

    c1 = anchor(e1, PRIYA_ESSAY, "repaired the weather", edit, "This is your best line. Consider letting it land harder: could the conclusion echo it? I'd end on the warm house but bring 'weather' back.")
    db.execute('INSERT INTO comments(essay_id,parent_id,author_id,start,"end",quote,body,resolved,created) VALUES(?,?,?,?,?,?,?,?,?)', (e1, c1, pri, None, None, None, "Good idea, I'll try a version tonight.", 0, ago(1)))
    anchor(e1, PRIYA_ESSAY, "Translating taught me something that engineering classes have not.", coun, "Strong pivot sentence. Admissions readers will see the thesis of the whole essay here.", days=2)
    anchor(e1, PRIYA_ESSAY, "I want to study engineering because I believe the best engineers are translators too.", edit, "Slightly abstract compared with the vivid first half. Add one concrete detail about what you'd build, e.g. medical devices or accessibility tools.", days=2)
    anchor(e1, PRIYA_ESSAY, "Fixing it took a screwdriver and a YouTube video.", edit, "Fun, but can you give us one sensory detail here? Smell of dust, click of the coil?", resolved=1, days=5)
    orig = "I had not repaired the weather, but I had learned that the point of understanding how something works is the person who gets to feel the difference."
    db.execute("INSERT INTO suggestions(essay_id,author_id,start,original,replacement,note,status,created) VALUES(?,?,?,?,?,?,?,?)",
               (e1, edit, PRIYA_ESSAY.find(orig), orig, "I had not repaired the weather, but I had learned that understanding how something works matters most to the person who gets to feel the difference.", "Tighter rhythm.", "pending", ago(2)))
    o2 = "I would like to spend my life making that kind of fix, at a larger scale, for people who may never know what is inside the box."
    db.execute("INSERT INTO suggestions(essay_id,author_id,start,original,replacement,note,status,created) VALUES(?,?,?,?,?,?,?,?)",
               (e1, coun, PRIYA_ESSAY.find(o2), o2, "I want to spend my life making that kind of fix at larger scale, for people who may never know what is inside the box.", "Avoid repeating 'would like' (used twice).", "pending", ago(2)))

    e2 = essay(pri, "supplemental", "MIT: Describe the world you come from", "Describe the world you come from (for example, your family, school, community, city, or town). How has that world shaped your dreams and aspirations? (250 words)", 250,
               "I come from a house where two languages share every conversation and neither one has all the words. My grandmother's Tamil carries proverbs my English cannot; my English carries the vocabulary of engines and circuits that Tamil never needed. Growing up in the gap between them taught me to build bridges for a living, one diagram at a time.", "Drafting", pc["Massachusetts Institute"])
    e3 = essay(pri, "supplemental", "Stanford: What matters to you and why?", "What matters most to you, and why? (250 words)", 250, "", "Not started", pc["Stanford"])
    e4 = essay(pri, "supplemental", "Georgia Tech: Why this major?", "Why do you want to study your chosen major at Georgia Tech? (300 words)", 300, "", "Not started", pc["Georgia Institute"])

    m1 = essay(mar, "personal", "Common App Personal Essay", P5, 650, MARCUS_ESSAY, "Revising")
    db.execute("INSERT INTO essay_versions(essay_id,content,note,author_id,words,created) VALUES(?,?,?,?,?,?)", (m1, MARCUS_ESSAY, "Draft 1", mar, len(MARCUS_ESSAY.split()), ago(6)))
    anchor(m1, MARCUS_ESSAY, "I was afraid of the boat.", edit, "Great hook, but the previous sentence says 'not because I am lazy' which reads defensive. Consider cutting it.", days=4)
    anchor(m1, MARCUS_ESSAY, "I still have the loud voice. I have learned when to use it and when to let a boat run silent, when eight people are breathing as one.", coun, "Lovely ending thought, but the final clause is clunky. Read it aloud.", days=3)
    db.execute("INSERT INTO suggestions(essay_id,author_id,start,original,replacement,note,status,created) VALUES(?,?,?,?,?,?,?,?)",
               (m1, edit, MARCUS_ESSAY.find("This is not because I am lazy. "), "This is not because I am lazy. It is because for most of my sophomore year I was afraid of the boat.", "For most of my sophomore year, I was afraid of the boat.", "Cut the defensive setup.", "pending", ago(4)))
    m2 = essay(mar, "supplemental", "Georgetown: Reflect on a place or community", "Reflect on a time you took on a leadership role in a community (250 words)", 250, "", "Not started", mc["Georgetown"])
    m3 = essay(mar, "supplemental", "UVA: What's your favorite word?", "What is your favorite word, and why? (100 words)", 100, "", "Not started", mc["University of Virginia"])

    # ---------------- Tasks
    def task(sid, title, due, cat, done=0, college=None, by=None):
        db.execute("INSERT INTO tasks(student_id,title,due,category,done,college_id,created_by,created,done_at) VALUES(?,?,?,?,?,?,?,?,?)", (sid, title, due, cat, done, college, by or sid, now(), now() if done else None))

    task(pri, "Finish MIT 'world you come from' essay", d(4), "Essay", 0, pc["Massachusetts Institute"], coun)
    task(pri, "Respond to Daniel's comments on personal essay", d(2), "Essay", 0, None, edit)
    task(pri, "Ask Mr. Ortiz for physics recommendation", d(-3), "Recommendations", 1, None, coun)
    task(pri, "Send Mrs. Chen the brag sheet", d(-1), "Recommendations", 0, None, coun)
    task(pri, "Submit Georgia Tech application", d(10), "Application", 0, pc["Georgia Institute"], coun)
    task(pri, "Submit MIT application", d(20), "Application", 0, pc["Massachusetts Institute"], coun)
    task(pri, "Request SAT score report to Stanford", d(30), "Testing", 0)
    task(pri, "Complete FAFSA/CSS profile with parents", d(25), "Financial aid", 0, None, coun)
    task(pri, "Finalize activities list ordering", d(-2), "Profile", 0, None, coun)
    task(mar, "Revise personal essay (draft 2)", d(3), "Essay", 0, None, edit)
    task(mar, "Add 5 more colleges (need a safety)", d(-5), "College list", 0, None, coun)
    task(mar, "Retake SAT: register for December date", d(9), "Testing", 0, None, coun)
    task(mar, "Fill in Family section: parent 2 details", d(-4), "Profile", 0, None, coun)
    task(mar, "Ask Ms. Adeyemi for coach recommendation", d(2), "Recommendations", 0, None, coun)
    task(mar, "Submit UVA application", d(18), "Application", 0, mc["University of Virginia"], coun)
    task(mar, "Schedule Georgetown alumni interview", d(7), "Application", 1, mc["Georgetown"], coun)

    # ---------------- Recommendations
    def rec(sid, name, kind, subj, email, status, requested, due, notes=""):
        db.execute("INSERT INTO recs(student_id,name,kind,subject,email,status,requested,due,notes) VALUES(?,?,?,?,?,?,?,?,?)", (sid, name, kind, subj, email, status, requested, due, notes))

    rec(pri, "Ms. Ellen Park", "Counsellor", "School counsellor", "epark@newtonacademy.example", "In progress", d(-30), d(8), "School report + letter")
    rec(pri, "Mr. Luis Ortiz", "Teacher", "Physics (AP Physics C)", "lortiz@newtonacademy.example", "Submitted", d(-25), d(8))
    rec(pri, "Mrs. Helen Chen", "Teacher", "Mathematics (AP Calc BC)", "hchen@newtonacademy.example", "Requested", d(-10), d(8), "Brag sheet not yet sent")
    rec(mar, "Mr. Paul Whitaker", "Counsellor", "School counsellor", "pwhitaker@quincycollegiate.example", "Requested", d(-14), d(15))
    rec(mar, "Ms. Ngozi Adeyemi", "Coach / Other", "Crew coach", "nadeyemi@quincycollegiate.example", "Not asked", None, d(15))
    rec(mar, "Dr. Ruth Alvarez", "Teacher", "AP US History", "ralvarez@quincycollegiate.example", "In progress", d(-20), d(15))

    # ---------------- SAT
    def sat(sid, kind, date, rw, math, note=""):
        db.execute("INSERT INTO sat_scores(student_id,kind,date,total,rw,math,note) VALUES(?,?,?,?,?,?,?)", (sid, kind, date, rw + math, rw, math, note))

    sat(pri, "practice", d(-150), 680, 700, "Bluebook Test 1, cold")
    sat(pri, "practice", d(-110), 700, 730, "Bluebook Test 2")
    sat(pri, "official", d(-70), 720, 750, "First sitting")
    sat(pri, "practice", d(-40), 730, 750)
    sat(pri, "official", d(-30), 740, 760, "Retake: best score")
    sat(mar, "practice", d(-120), 600, 560, "Bluebook Test 1")
    sat(mar, "practice", d(-90), 640, 580, "")
    sat(mar, "official", d(-75), 680, 610, "First sitting")
    sat(mar, "practice", d(-20), 690, 640, "Math improving")
    kv = lambda sid, k, v: db.execute("INSERT OR REPLACE INTO kv VALUES(?,?,?)", (sid, k, v))
    kv(pri, "sat_target", "1520")
    kv(pri, "sat_plan", "steady8")
    kv(pri, "sat_progress", json.dumps({}))
    kv(mar, "sat_target", "1400")
    kv(mar, "sat_plan", "deep12")
    kv(mar, "sat_progress", json.dumps({"deep12:1:0": True, "deep12:1:1": True, "deep12:1:2": True, "deep12:2:0": True, "deep12:2:1": True}))

    # ---------------- Messages & events
    def msg(sid, ch, sender, body, days):
        db.execute("INSERT INTO messages(student_id,channel,sender_id,body,created) VALUES(?,?,?,?,?)", (sid, ch, sender, body, ago(days)))

    msg(pri, "team", coun, "Hi Priya, welcome to the platform. Daniel will be your essay editor and I'll track your list and deadlines. First goal: finalize the personal essay by the end of next week.", 9)
    msg(pri, "team", pri, "Thank you! I uploaded my first full draft. Should I start MIT supplements now?", 8)
    msg(pri, "team", edit, "Drafts first, supplements second. I left comments on your essay, especially the ending. Great opening!", 2)
    msg(pri, "staff", coun, "Priya is strong on the engineering story. Watch her workload: robotics season starts in January.", 3)
    msg(pri, "staff", edit, "Agreed. Her essay is nearly there; I'd like one more revision pass before we call it final.", 2)
    msg(mar, "team", coun, "Marcus, great to have you. Priorities this week: 1) add a safety school or two, 2) fix the Family section, 3) revise your essay with Daniel's notes.", 6)
    msg(mar, "team", mar, "On it. Practice at 5 AM tomorrow but I'll get to the list tonight.", 5)
    msg(mar, "team", edit, "Your rowing metaphor is the strongest thing in the essay. Let's make the ending match it.", 4)
    for sid, who, kind, text, days in [
        (pri, pri, "essay", "saved a new version of 'Common App Personal Essay'", 3), (pri, edit, "comment", "commented on 'Common App Personal Essay'", 2),
        (pri, coun, "suggestion", "suggested an edit on 'Common App Personal Essay'", 2), (pri, pri, "college", "added Purdue University to the college list", 4),
        (mar, mar, "essay", "saved a new version of 'Common App Personal Essay'", 6), (mar, edit, "comment", "commented on 'Common App Personal Essay'", 4),
        (mar, coun, "task", "added task 'Add 5 more colleges (need a safety)'", 7)]:
        db.execute("INSERT INTO events(student_id,actor_id,kind,text,created) VALUES(?,?,?,?,?)", (sid, who, kind, text, ago(days)))
    db.commit()
