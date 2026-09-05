ALTER TABLE users
ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user';

-- 에릭 계정을 admin으로
UPDATE users
SET role = 'admin'
WHERE email = 'erishforG@gmail.com';
