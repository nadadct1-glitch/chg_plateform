"""Script de test bout-en-bout de l'API (exécuté manuellement pendant le développement)."""
import sys

import requests

BASE = "http://localhost:8000"


def check(label, cond, extra=""):
    status = "OK" if cond else "FAIL"
    print(f"[{status}] {label} {extra}")
    if not cond:
        FAILURES.append(label)


FAILURES = []


def h(token):
    return {"Authorization": f"Bearer {token}"}


# 1) Login admin
r = requests.post(f"{BASE}/api/auth/login", json={"username": "admin", "password": "ChangeMoi123!"})
check("login admin", r.status_code == 200, r.text[:200])
admin_token = r.json()["access_token"]

# 1b) Bad login
r = requests.post(f"{BASE}/api/auth/login", json={"username": "admin", "password": "wrong"})
check("login refuse mauvais mdp", r.status_code == 401)

# 2) Create a founder user
r = requests.post(f"{BASE}/api/users", headers=h(admin_token), json={
    "username": "kodjo.mensah", "password": "Fondateur2026!", "role": "fondateur",
    "full_name": "Kodjo Mensah", "email": "kodjo@chg.tg", "phone": "+228 90 00 00 01",
})
check("creation fondateur", r.status_code == 201, r.text[:300])
founder = r.json()
founder_id = founder["id"]

# 2b) Duplicate username rejected
r = requests.post(f"{BASE}/api/users", headers=h(admin_token), json={
    "username": "kodjo.mensah", "password": "xxxxxx", "role": "employe", "full_name": "Doublon",
})
check("doublon identifiant refuse", r.status_code == 409)

# 3) Create an employee user
r = requests.post(f"{BASE}/api/users", headers=h(admin_token), json={
    "username": "ama.koffi", "password": "Employe2026!", "role": "employe",
    "full_name": "Ama Koffi", "email": "ama@chg.tg",
})
check("creation employe", r.status_code == 201, r.text[:300])
employee = r.json()
employee_id = employee["id"]

# 4) Login as founder
r = requests.post(f"{BASE}/api/auth/login", json={"username": "kodjo.mensah", "password": "Fondateur2026!"})
check("login fondateur", r.status_code == 200)
founder_token = r.json()["access_token"]

# 4b) Login as employee
r = requests.post(f"{BASE}/api/auth/login", json={"username": "ama.koffi", "password": "Employe2026!"})
check("login employe", r.status_code == 200)
employee_token = r.json()["access_token"]

# 5) List users (annuaire)
r = requests.get(f"{BASE}/api/users", headers=h(employee_token))
check("annuaire visible par employe", r.status_code == 200 and len(r.json()) == 3, f"n={len(r.json())}")

# 6) Create a task assigned to employee, with 3 steps (calendar)
r = requests.post(f"{BASE}/api/tasks", headers=h(founder_token), json={
    "title": "Recenser les besoins - Region Maritime",
    "description": "Enquete de terrain phase 1",
    "category": "Etude de marche",
    "assigned_to_id": employee_id,
    "start_date": "2026-09-15",
    "end_date": "2026-10-15",
    "steps": [
        {"title": "Preparation des questionnaires", "step_date": "2026-09-17", "status": "valide"},
        {"title": "Enquete de terrain", "step_date": "2026-09-30", "status": "en_cours"},
        {"title": "Redaction du rapport", "step_date": "2026-10-15", "status": "non_entame"},
    ],
})
check("creation tache staff", r.status_code == 201, r.text[:300])
task = r.json()
task_id = task["id"]
check("progres calcule (1 vert,1 orange,1 rouge = 50%)", task["progress_percent"] == 50, task["progress_percent"])
check("statut derive = en_cours", task["status"] == "en_cours", task["status"])

# 6b) Employee cannot see other staff-only fields but CAN see own task
r = requests.get(f"{BASE}/api/tasks/{task_id}", headers=h(employee_token))
check("employe voit sa tache assignee", r.status_code == 200)

# 6c) Employee cannot create a task (staff only)
r = requests.post(f"{BASE}/api/tasks", headers=h(employee_token), json={"title": "Non autorise"})
check("employe ne peut pas creer de tache", r.status_code == 403)

# 6d) Mark last step as done -> should reach 100% and status valide
step_id = task["steps"][2]["id"]
r = requests.patch(f"{BASE}/api/tasks/{task_id}/steps/{step_id}", headers=h(founder_token),
                    json={"status": "valide"})
check("mise a jour etape", r.status_code == 200)
r = requests.patch(f"{BASE}/api/tasks/{task_id}/steps/{task['steps'][1]['id']}", headers=h(founder_token),
                    json={"status": "valide"})
updated_task = r.json()
check("toutes etapes validees -> 100%", updated_task["progress_percent"] == 100, updated_task["progress_percent"])
check("statut global = valide", updated_task["status"] == "valide", updated_task["status"])

# 7) Registration application (public, no auth)
r = requests.post(f"{BASE}/api/registrations", json={
    "full_name": "Essowe Pali", "email": "essowe@example.com", "phone": "90112233",
    "requested_role": "employe_junior", "domain_interest": "Agriculture",
    "motivation": "Je souhaite rejoindre le projet agricole du conglomerat.",
})
check("candidature publique", r.status_code == 201, r.text[:300])
application = r.json()
app_id = application["id"]

# 7b) Employee cannot see applications
r = requests.get(f"{BASE}/api/registrations", headers=h(employee_token))
check("employe ne voit pas les candidatures", r.status_code == 403)

# 7c) Admin approves -> creates account
r = requests.post(f"{BASE}/api/registrations/{app_id}/approve", headers=h(admin_token), json={
    "username": "essowe.pali", "password": "Bienvenue2026!", "note": "Profil valide",
})
check("approbation candidature", r.status_code == 200, r.text[:300])

# 7d) New user can log in
r = requests.post(f"{BASE}/api/auth/login", json={"username": "essowe.pali", "password": "Bienvenue2026!"})
check("connexion nouveau membre approuve", r.status_code == 200)

# 8) Role change (status evolution) + history
r = requests.patch(f"{BASE}/api/users/{employee_id}/role", headers=h(admin_token), json={
    "new_role": "employe_junior", "note": "Evolution apres evaluation trimestrielle",
})
check("evolution de statut", r.status_code == 200 and r.json()["role"] == "employe_junior")
r = requests.get(f"{BASE}/api/users/{employee_id}/history", headers=h(admin_token))
check("historique de statut (2 entrees)", r.status_code == 200 and len(r.json()) == 2, len(r.json()))

# 9) Chat: general open to all, fondateurs restricted
r = requests.post(f"{BASE}/api/chat/general", headers=h(employee_token), json={"content": "Bonjour a tous !"})
check("employe peut ecrire sur #general", r.status_code == 201)
r = requests.post(f"{BASE}/api/chat/fondateurs", headers=h(employee_token), json={"content": "Intrusion"})
check("employe REFUSE sur #fondateurs", r.status_code == 403)
r = requests.post(f"{BASE}/api/chat/fondateurs", headers=h(founder_token), json={"content": "Ordre du jour du comite"})
check("fondateur peut ecrire sur #fondateurs", r.status_code == 201)
r = requests.get(f"{BASE}/api/chat/general", headers=h(employee_token))
check("lecture #general", r.status_code == 200 and len(r.json()) >= 1)

# 10) Meetings
r = requests.post(f"{BASE}/api/meetings", headers=h(founder_token), json={
    "title": "Comite de direction hebdomadaire",
    "starts_at": "2026-09-18T09:00:00", "location": "Siege - Adidogome",
    "participant_ids": [founder_id, employee_id],
})
check("creation reunion", r.status_code == 201, r.text[:300])
meeting_id = r.json()["id"]
r = requests.patch(f"{BASE}/api/meetings/{meeting_id}/rsvp", headers=h(employee_token), json={"response": "accepte"})
check("rsvp reunion", r.status_code == 200)

# 11) Process item update
r = requests.get(f"{BASE}/api/process", headers=h(admin_token))
first_item_id = r.json()[0]["phases"][0]["tasks"][0]["items"][0]["id"]
r = requests.patch(f"{BASE}/api/process/items/{first_item_id}", headers=h(admin_token),
                    json={"status": "valide", "assigned_to_id": founder_id})
check("maj item processus", r.status_code == 200 and r.json()["status"] == "valide")
r = requests.get(f"{BASE}/api/process", headers=h(admin_token))
sect0 = r.json()[0]
check("progres section recalcule > 0", sect0["progress_percent"] > 0, sect0["progress_percent"])

# 12) Site content + domains + projects (public, no auth)
r = requests.get(f"{BASE}/api/content/site")
check("contenu site public", r.status_code == 200 and "mission" in r.json())
r = requests.get(f"{BASE}/api/content/domains")
check("domaines public", r.status_code == 200 and len(r.json()) == 16)
r = requests.get(f"{BASE}/api/content/projects")
check("projets public", r.status_code == 200 and len(r.json()) == 7)
r = requests.get(f"{BASE}/api/content/roles")
check("referentiel roles public", r.status_code == 200 and len(r.json()) == 11, len(r.json()))

# 12b) Non-admin cannot edit site content
r = requests.patch(f"{BASE}/api/content/site/mission", headers=h(employee_token), json={"value": "hack"})
check("employe ne peut pas modifier le contenu du site", r.status_code == 403)
r = requests.patch(f"{BASE}/api/content/site/mission", headers=h(admin_token), json={"value": "Nouvelle mission test"})
check("admin peut modifier le contenu du site", r.status_code == 200)

# 13) Dashboard staff-only
r = requests.get(f"{BASE}/api/dashboard", headers=h(employee_token))
check("dashboard refuse a un simple employe", r.status_code == 403)
r = requests.get(f"{BASE}/api/dashboard", headers=h(founder_token))
check("dashboard accessible a un fondateur", r.status_code == 200, r.text[:300])

# 14) Change password
r = requests.post(f"{BASE}/api/auth/change-password", headers=h(employee_token),
                   json={"current_password": "Employe2026!", "new_password": "NouveauMdp2026!"})
check("changement de mot de passe", r.status_code == 200)
r = requests.post(f"{BASE}/api/auth/login", json={"username": "ama.koffi", "password": "NouveauMdp2026!"})
check("connexion avec le nouveau mot de passe", r.status_code == 200)

print("\n" + "=" * 50)
if FAILURES:
    print(f"{len(FAILURES)} TEST(S) EN ECHEC:")
    for f in FAILURES:
        print("  -", f)
    sys.exit(1)
else:
    print("TOUS LES TESTS SONT PASSES (OK)")
