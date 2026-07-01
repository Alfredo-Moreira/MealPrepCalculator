#!/usr/bin/env python3
"""
One-time migration: introduce Users + plan sequencing onto existing data.

Run once per target MongoDB instance:

    pip install pymongo
    MONGODB_URI="mongodb://localhost:27017/meal-prep" python scripts/migrate-add-users.py

What it does:
  1. Ensures a default user "Me" exists (collection: users).
  2. For every profile missing a user_id: attaches it to "Me", backfills
     start_date (from created_at), status ('active'), and assigns a per-user
     `sequence` in created_at order.
  3. Backfills user_id on any check-ins from their parent profile.

Idempotent: re-running only touches documents that still need backfilling.

Collection names match Mongoose's defaults: users, profiles, mealplans, checkins.
"""
import os
import sys
from datetime import datetime, timezone

try:
    from pymongo import MongoClient, ASCENDING, DESCENDING
    from pymongo.errors import ConfigurationError
except ImportError:
    sys.exit('pymongo is required. Install it with:  pip install pymongo')


def get_db(client, uri):
    """Use the database from the URI if present, else fall back to 'meal-prep'."""
    try:
        db = client.get_default_database()
        if db is not None:
            return db
    except ConfigurationError:
        pass
    return client['meal-prep']


def main():
    uri = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/meal-prep')
    client = MongoClient(uri)
    db = get_db(client, uri)

    users = db['users']
    profiles = db['profiles']
    checkins = db['checkins']

    now = datetime.now(timezone.utc)

    # 1. Default user
    me = users.find_one({'name': 'Me'})
    if me is None:
        result = users.insert_one({'name': 'Me', 'notes': '', 'created_at': now, 'updated_at': now})
        me_id = result.inserted_id
        print(f'Created default user "Me" ({me_id})')
    else:
        me_id = me['_id']
        print(f'Default user "Me" already exists ({me_id})')

    # 2. Orphan profiles -> attach + backfill, ordered by creation for a stable sequence.
    orphan_query = {'$or': [{'user_id': {'$exists': False}}, {'user_id': None}]}
    orphans = list(profiles.find(orphan_query).sort('created_at', ASCENDING))
    print(f'Found {len(orphans)} profile(s) without a user_id.')

    # Continue the sequence after anything "Me" may already have.
    last = profiles.find_one({'user_id': me_id}, sort=[('sequence', DESCENDING)])
    seq = (last.get('sequence') or 0) if last else 0

    for p in orphans:
        seq += 1
        updates = {'user_id': me_id, 'sequence': seq}
        if p.get('start_date') is None:
            updates['start_date'] = p.get('created_at') or now
        if p.get('status') is None:
            updates['status'] = 'active'
        profiles.update_one({'_id': p['_id']}, {'$set': updates})
        print(f'  - "{p.get("name")}" -> user=Me, sequence={seq}')

    # 3. Check-ins missing user_id
    ci_orphans = list(checkins.find({'$or': [{'user_id': {'$exists': False}}, {'user_id': None}]}))
    fixed = 0
    for c in ci_orphans:
        parent = profiles.find_one({'_id': c.get('profile_id')})
        if parent and parent.get('user_id'):
            checkins.update_one({'_id': c['_id']}, {'$set': {'user_id': parent['user_id']}})
            fixed += 1
    if ci_orphans:
        print(f'Backfilled user_id on {fixed}/{len(ci_orphans)} check-in(s).')

    print('Migration complete.')
    client.close()


if __name__ == '__main__':
    try:
        main()
    except Exception as err:  # noqa: BLE001
        print(f'Migration failed: {err}', file=sys.stderr)
        sys.exit(1)
