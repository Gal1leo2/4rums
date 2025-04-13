// // src/lib/auth/googleAuth.js
// import { supabase } from '$lib/supabase/client';

// /**
//  * Signs in with Google and handles the authentication flow
//  * @param {string} redirectTo - The URL to redirect to after successful login
//  * @returns {Promise<{success: boolean, error?: string}>}
//  */
// export async function signInWithGoogle(redirectTo = '/') {
//   try {
//     const { data, error } = await supabase.auth.signInWithOAuth({
//       provider: 'google',
//       options: {
//         redirectTo: window.location.origin + '/auth/callback?redirectTo=' + redirectTo,
//         queryParams: {
//           access_type: 'offline', // For getting a refresh token
//           prompt: 'consent'       // Force consent to get fresh tokens
//         }
//       }
//     });
    
//     if (error) {
//       console.error('Google login error:', error);
//       return { success: false, error: error.message };
//     }
    
//     return { success: true };
//   } catch (e) {
//     console.error('Exception during Google sign in:', e);
//     return { success: false, error: 'An unexpected error occurred' };
//   }
// }

// /**
//  * Checks if the current user has admin privileges
//  * @returns {Promise<boolean>}
//  */
// export async function checkAdminStatus() {
//   try {
//     const { data: { session } } = await supabase.auth.getSession();
    
//     if (!session) return false;
    
//     // Check if user email is in admin list
//     const userEmail = session.user.email;
//     const adminEmails = ['66050977@kmitl.ac.th']; // Add your admin emails here
    
//     if (adminEmails.includes(userEmail)) {
//       // Check or set admin role in database
//       await ensureUserRole(session.user.id, 'instructor');
//       return true;
//     }
    
//     return false;
//   } catch (error) {
//     console.error('Error checking admin status:', error);
//     return false;
//   }
// }

// /**
//  * Ensures the user has the correct role in the database
//  * @param {string} userId - The user's ID 
//  * @param {string} role - The role to set ('instructor', 'ta', 'student')
//  */
// export async function ensureUserRole(userId, role) {
//   try {
//     // First check if user exists and what their current role is
//     const { data: existingUser, error: fetchError } = await supabase
//       .from('users')
//       .select('id, role')
//       .eq('id', userId)
//       .single();
    
//     if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "row not found"
//       console.error('Error fetching user:', fetchError);
//       return false;
//     }
    
//     if (!existingUser) {
//       // User doesn't exist, get user details from auth
//       const { data: { user } } = await supabase.auth.getUser();
      
//       if (!user) return false;
      
//       // Create user with role
//       const { error: insertError } = await supabase
//         .from('users')
//         .insert({
//           id: userId,
//           email: user.email,
//           full_name: user.user_metadata.full_name || 'User',
//           role: role,
//           hashed_password: 'OAUTH_USER'
//         });
      
//       if (insertError) {
//         console.error('Error creating user:', insertError);
//         return false;
//       }
//     } else if (existingUser.role !== role) {
//       // Update role if different
//       const { error: updateError } = await supabase
//         .from('users')
//         .update({ role })
//         .eq('id', userId);
      
//       if (updateError) {
//         console.error('Error updating user role:', updateError);
//         return false;
//       }
//     }
    
//     return true;
//   } catch (error) {
//     console.error('Error ensuring user role:', error);
//     return false;
//   }
// }

// /**
//  * Checks if the current user has TA privileges for a specific course
//  * @param {string} courseId - The course ID to check
//  * @returns {Promise<boolean>}
//  */
// export async function checkTAStatus(courseId) {
//   try {
//     const { data: { session } } = await supabase.auth.getSession();
    
//     if (!session) return false;
    
//     // Check if this user is marked as TA in the course_members table
//     const { data, error } = await supabase
//       .from('course_members')
//       .select('*')
//       .eq('user_id', session.user.id)
//       .eq('course_id', courseId)
//       .eq('role', 'ta')
//       .single();
    
//     if (error || !data) {
//       // Not a TA, check if we should auto-set as TA
//       const userEmail = session.user.email;
//       const taEmails = ['66050977@kmitl.ac.th']; // Add your TA emails here
      
//       if (taEmails.includes(userEmail)) {
//         // Automatically set as TA for this course
//         await assignTARole(session.user.id, courseId);
//         return true;
//       }
//       return false;
//     }
    
//     return true;
//   } catch (error) {
//     console.error('Error checking TA status:', error);
//     return false;
//   }
// }

// /**
//  * Assigns a user as a TA for a specific course
//  * @param {string} userId - The user's ID
//  * @param {string} courseId - The course ID
//  */
// export async function assignTARole(userId, courseId) {
//   try {
//     // Check if relationship already exists
//     const { data: existing, error: fetchError } = await supabase
//       .from('course_members')
//       .select('*')
//       .eq('user_id', userId)
//       .eq('course_id', courseId)
//       .single();
    
//     if (fetchError && fetchError.code !== 'PGRST116') {
//       console.error('Error checking course membership:', fetchError);
//       return false;
//     }
    
//     if (existing) {
//       // Update existing relationship
//       const { error: updateError } = await supabase
//         .from('course_members')
//         .update({ role: 'ta' })
//         .eq('user_id', userId)
//         .eq('course_id', courseId);
      
//       if (updateError) {
//         console.error('Error updating course membership:', updateError);
//         return false;
//       }
//     } else {
//       // Create new membership
//       const { error: insertError } = await supabase
//         .from('course_members')
//         .insert({
//           user_id: userId,
//           course_id: courseId,
//           role: 'ta'
//         });
      
//       if (insertError) {
//         console.error('Error creating course membership:', insertError);
//         return false;
//       }
//     }
    
//     return true;
//   } catch (error) {
//     console.error('Error assigning TA role:', error);
//     return false;
//   }
// }