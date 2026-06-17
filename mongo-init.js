db = db.getSiblingDB('restaurant_credit');

db.createUser({
  user: 'restaurant_user',
  pwd: 'restaurant_pass_2024',
  roles: [
    {
      role: 'readWrite',
      db: 'restaurant_credit'
    }
  ]
});

// Create indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ companyId: 1 });
db.employees.createIndex({ companyId: 1 });
db.employees.createIndex({ email: 1 }, { unique: true });
db.ledgertransactions.createIndex({ employeeId: 1 });
db.ledgertransactions.createIndex({ companyId: 1 });
db.ledgertransactions.createIndex({ idempotencyKey: 1 }, { unique: true, sparse: true });
db.ledgertransactions.createIndex({ createdAt: -1 });
