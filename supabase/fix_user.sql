-- Fix: Create dummy user for API key authentication
-- The backend uses a hardcoded user_id that needs to exist in auth.users

-- Insert dummy user if not exists
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'api@lanista.local',
    '$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', -- dummy hash
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Also ensure the user exists in the public schema if referenced
INSERT INTO public.users (id, email, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'api@lanista.local',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Verify
SELECT id, email FROM auth.users WHERE id = '00000000-0000-0000-0000-000000000001';
