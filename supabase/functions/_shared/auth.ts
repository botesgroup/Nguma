// supabase/functions/_shared/auth.ts

import { createClient, User } from 'https://esm.sh/@supabase/supabase-js@2';

class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Authenticates a user based on the Authorization header JWT.
 * Throws an error if the token is missing, invalid, or the user is not found.
 * @param req The incoming request object.
 * @returns The authenticated Supabase user object.
 */
export const authenticateUser = async (req: Request): Promise<User> => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new AuthError('Missing Authorization header');
  }

  const token = authHeader.replace('Bearer ', '');

  // Create a Supabase client with the public anon key to verify the JWT
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error) {
    console.error('JWT validation error:', error.message);
    throw new AuthError('Invalid token');
  }

  if (!user) {
    throw new AuthError('User not found');
  }

  return user;
};

/**
 * Checks if the request is from a trusted server-side source
 * by comparing the Authorization header to the service role key.
 * Now also checks the 'apikey' header as a fallback, which is standard for Supabase client libraries.
 * It also checks for a custom 'X-Internal-Secret' for robust inter-function calls.
 * @param req The incoming request object.
 * @returns True if the key matches, false otherwise.
 */
export const isServiceRole = (req: Request): boolean => {
  // 1. Check for a custom internal secret (most secure for function-to-function)
  const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET');
  const incomingSecret = req.headers.get('X-Internal-Secret');
  if (internalSecret && incomingSecret && internalSecret === incomingSecret) {
    return true;
  }

  // 2. Fallback to service_role_key checks
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceRoleKey) {
    return false;
  }

  // Check standard Authorization header
  const authHeader = req.headers.get('Authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    if (token === serviceRoleKey) {
      return true;
    }
  }

  // Fallback to check 'apikey' header (used by Supabase clients and pg_net)
  const apiKeyHeader = req.headers.get('apikey');
  if (apiKeyHeader) {
    if (apiKeyHeader === serviceRoleKey) {
      return true;
    }
  }

  return false;
}
