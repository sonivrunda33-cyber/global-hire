"""Create or promote a local GlobalHire administrator account."""
from getpass import getpass

from werkzeug.security import generate_password_hash

from app import app, get_db, init_db


def main() -> None:
    init_db()
    name = input("Admin full name: ").strip()
    email = input("Admin email: ").strip().lower()
    password = getpass("Admin password (8+ characters): ")
    if len(name) < 2 or "@" not in email or len(password) < 8:
        raise SystemExit("Please enter a valid name and email, and a password of at least 8 characters.")

    with app.app_context():
        db = get_db()
        existing = db.execute("SELECT id FROM profiles WHERE email=?", (email,)).fetchone()
        if existing:
            db.execute("UPDATE profiles SET role='admin',full_name=?,password_hash=? WHERE id=?",
                       (name, generate_password_hash(password), existing["id"]))
            message = "Existing account promoted to administrator."
        else:
            db.execute("INSERT INTO profiles(full_name,email,password_hash,role) VALUES(?,?,?,'admin')",
                       (name, email, generate_password_hash(password)))
            message = "Administrator account created."
        db.commit()
    print(message)
    print("You can now sign in at /login and open /admin.")


if __name__ == "__main__":
    main()
