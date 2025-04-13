// // src/lib/auth/roleUtils.js
// import { supabase } from '$lib/supabase/client';

// /**
//  * Gets the user's role for a specific course
//  * @param {string} userId - The user ID
//  * @param {string} courseId - The course ID
//  * @returns {Promise<string|null>} The role or null if not found
//  */
// export async function getUserCourseRole(userId, courseId) {
//   if (!userId || !courseId) return null;
  
//   try {
//     const { data, error } = await supabase
//       .from('course_members')
//       .select('role')
//       .eq('user_id', userId)
//       .eq('course_id', courseId)
//       .single();
      
//     if (error) {
//       console.error('Error getting user course role:', error);
//       return null;
//     }
    
//     return data?.role || null;
//   } catch (error) {
//     console.error('Exception in getUserCourseRole:', error);
//     return null;
//   }
// }

// /**
//  * Checks if a user has one of the specified roles for a course
//  * @param {string} userId - The user ID
//  * @param {string} courseId - The course ID
//  * @param {string|string[]} roles - Role or array of roles to check
//  * @returns {Promise<boolean>} True if user has one of the roles
//  */
// export async function hasRoleForCourse(userId, courseId, roles) {
//   if (!userId || !courseId) return false;
  
//   try {
//     const userRole = await getUserCourseRole(userId, courseId);
    
//     if (!userRole) return false;
    
//     if (Array.isArray(roles)) {
//       return roles.includes(userRole);
//     }
    
//     return userRole === roles;
//   } catch (error) {
//     console.error('Exception in hasRoleForCourse:', error);
//     return false;
//   }
// }

// /**
//  * Checks if the user is an instructor for a given course
//  * @param {string} userId - The user ID
//  * @param {string} courseId - The course ID
//  * @returns {Promise<boolean>}
//  */
// export async function isInstructor(userId, courseId) {
//   return hasRoleForCourse(userId, courseId, 'instructor');
// }

// /**
//  * Checks if the user is a TA for a given course
//  * @param {string} userId - The user ID
//  * @param {string} courseId - The course ID
//  * @returns {Promise<boolean>}
//  */
// export async function isTA(userId, courseId) {
//   return hasRoleForCourse(userId, courseId, 'ta');
// }

// /**
//  * Checks if the user is a student for a given course
//  * @param {string} userId - The user ID
//  * @param {string} courseId - The course ID
//  * @returns {Promise<boolean>}
//  */
// export async function isStudent(userId, courseId) {
//   return hasRoleForCourse(userId, courseId, 'student');
// }

// /**
//  * Checks if the user can manage course content (instructor or TA)
//  * @param {string} userId - The user ID
//  * @param {string} courseId - The course ID
//  * @returns {Promise<boolean>}
//  */
// export async function canManageCourse(userId, courseId) {
//   return hasRoleForCourse(userId, courseId, ['instructor', 'ta']);
// }

// /**
//  * Get the user's global role from the users table
//  * @param {string} userId - The user ID
//  * @returns {Promise<string|null>} The role or null if not found
//  */
// export async function getUserGlobalRole(userId) {
//   if (!userId) return null;
  
//   try {
//     const { data, error } = await supabase
//       .from('users')
//       .select('role')
//       .eq('id', userId)
//       .single();
      
//     if (error) {
//       console.error('Error getting user global role:', error);
//       return null;
//     }
    
//     return data?.role || null;
//   } catch (error) {
//     console.error('Exception in getUserGlobalRole:', error);
//     return null;
//   }
// }

// /**
//  * Checks if a user is an instructor for any course
//  * @param {string} userId - The user ID
//  * @returns {Promise<boolean>}
//  */
// export async function isInstructorAnywhere(userId) {
//   if (!userId) return false;
  
//   try {
//     // First check global role
//     const globalRole = await getUserGlobalRole(userId);
//     if (globalRole === 'instructor') return true;
    
//     // Then check course memberships
//     const { data, error } = await supabase
//       .from('course_members')
//       .select('id')
//       .eq('user_id', userId)
//       .eq('role', 'instructor')
//       .limit(1);
      
//     if (error) {
//       console.error('Error checking instructor status:', error);
//       return false;
//     }
    
//     return data && data.length > 0;
//   } catch (error) {
//     console.error('Exception in isInstructorAnywhere:', error);
//     return false;
//   }
// }