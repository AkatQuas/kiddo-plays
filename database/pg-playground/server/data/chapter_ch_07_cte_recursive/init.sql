-- Chapter 7: Recursive CTE - organization tree
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  parent_id INTEGER REFERENCES departments(id)
);

INSERT INTO departments (id, name, parent_id) VALUES
  (1, 'CEO', NULL),
  (2, 'Engineering', 1),
  (3, 'Sales', 1),
  (4, 'Backend', 2),
  (5, 'Frontend', 2),
  (6, 'Enterprise Sales', 3),
  (7, 'SMB Sales', 3),
  (8, 'API Team', 4),
  (9, 'Data Team', 4)
ON CONFLICT DO NOTHING;

SELECT setval('departments_id_seq', (SELECT MAX(id) FROM departments));
