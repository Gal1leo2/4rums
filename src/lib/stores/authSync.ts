// src/lib/auth/authSync.js
import { supabase } from '$lib/supabase/client';

/**
 * Synchronizes Supabase Auth user with the users table
 * Creates or updates a user record in the users table based on auth data
 * @param {Object} authUser - The user object from Supabase Auth
 * @param {string} [defaultRole='student'] - Default role if none is specified
 * @returns {Promise<Object>} The synchronized user record
 */
export async function syncUserWithDatabase(authUser, defaultRole = 'student') {
  if (!authUser || !authUser.id || !authUser.email) {
    console.error('Invalid auth user data for sync:', authUser);
    throw new Error('Invalid user data');
  }

  try {
    // Check if user already exists in the users table
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "row not found"
      console.error('Error checking user existence:', fetchError);
      throw new Error('Database error while checking user');
    }

    // Determine if the user has a special role based on email
    let role = determineUserRole(authUser.email) || defaultRole;
    
    if (existingUser) {
      // User exists, update their record with latest auth info
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          email: authUser.email,
          full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || 'User',
          last_login: new Date().toISOString()
        })
        .eq('id', authUser.id)
        .select()
        .single();
      
      if (updateError) {
        console.error('Error updating user in database:', updateError);
        throw new Error('Failed to update user in database');
      }
      
      return updatedUser;
    } else {
      // User doesn't exist, create a new record
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          email: authUser.email,
          full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || 'User',
          role: role,
          hashed_password: 'OAUTH_USER', // Placeholder for OAuth users
          last_login: new Date().toISOString()
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('Error creating user in database:', insertError);
        throw new Error('Failed to create user in database');
      }
      
      // If this is a special role, also add them to appropriate courses
      if (role === 'instructor' || role === 'ta') {
        await setupSpecialUserCourses(authUser.id, role);
      }
      
      return newUser;
    }
  } catch (error) {
    console.error('Error in syncUserWithDatabase:', error);
    throw error;
  }
}

/**
 * Determines the user role based on email
 * @param {string} email - The user's email
 * @returns {string|null} The role or null if no special role
 */
function determineUserRole(email) {
  // Add special email mappings here
  const roleMap = {
    '66050977@kmitl.ac.th': 'instructor', // Special admin user
    // Add more special emails as needed
  };
  
  return roleMap[email] || null;
}

/**
 * Setup course memberships for instructors and TAs
 * @param {string} userId - The user ID
 * @param {string} role - The user role (instructor or ta) 
 */
async function setupSpecialUserCourses(userId, role) {
  try {
    // Get all active courses
    const { data: courses, error: courseError } = await supabase
      .from('courses')
      .select('id')
      .eq('is_active', true);
    
    if (courseError) {
      console.error('Error fetching courses for special user setup:', courseError);
      return;
    }
    
    if (!courses || courses.length === 0) {
      console.log('No active courses found for special user setup');
      return;
    }
    
    // Create course memberships for each course
    const memberships = courses.map(course => ({
      user_id: userId,
      course_id: course.id,
      role: role
    }));
    
    const { error: membershipError } = await supabase
      .from('course_members')
      .upsert(memberships, { 
        onConflict: 'course_id,user_id',
        ignoreDuplicates: false
      });
    
    if (membershipError) {
      console.error('Error setting up course memberships:', membershipError);
    }
  } catch (error) {
    console.error('Error in setupSpecialUserCourses:', error);
  }
}