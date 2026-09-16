"""Populate the dev database with a sample student week. Safe to re-run."""
from app.seed import bootstrap

if __name__ == "__main__":
    bootstrap(with_samples=True)
    print("Seeded student 1 with sample tasks.")
