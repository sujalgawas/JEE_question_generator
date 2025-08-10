// authUtils.js

/**
 * Checks if a user is currently logged in based on the presence of 'userName' in localStorage.
 * @returns {boolean} True if a user is logged in, false otherwise.
 */
export const checkLoginStatus = () => {
    return !!localStorage.getItem('userName');
};
