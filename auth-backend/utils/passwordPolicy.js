const zxcvbn = require('zxcvbn');

function validatePassword(password, email = '') {
    const errors = [];
    
    if (!password || password.length < 12) {
        errors.push('Password must be at least 12 characters long');
    }

    if (password && password.length > 128) {
        errors.push('Password must be no more than 128 characters long');
    }

    if (password && !password.match(/[A-Z]/)) {
        errors.push('Password must contain at least one uppercase letter');
    }

    if (password && !password.match(/[a-z]/)) {
        errors.push('Password must contain at least one lowercase letter');
    }

    if (password && !password.match(/[0-9]/)) {
        errors.push('Password must contain at least one number');
    }

    if (password && !password.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)) {
        errors.push('Password must contain at least one special character');
    }
    
    if (password && errors.length === 0) {
        // Pass email as user input to zxcvbn for personal info detection
        const result = zxcvbn(password, [email]);
        
        if (result.feedback.warning && result.feedback.warning.includes('common')) {
            errors.push('Password is too common and easily guessable');
        }

        if (result.score <= 1) {
            errors.push('Password is too weak');
            if (result.feedback.suggestions && result.feedback.suggestions.length > 0) {
                errors.push(...result.feedback.suggestions);
            }
        }
        
        if (result.match_sequence && result.match_sequence.some(match => 
            match.pattern === 'user_inputs')) {
            errors.push('Password contains personal information');
        }
        
        if (email) {
            const emailParts = email.toLowerCase().split(/[@._\-+]/).filter(part => part.length >= 3);
            const containsEmailPart = emailParts.some(part => 
                password.toLowerCase().includes(part));
            
            if (containsEmailPart) {
                errors.push('Password contains parts of your email address');
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

module.exports = { validatePassword };
