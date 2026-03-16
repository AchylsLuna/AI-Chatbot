const normalizeValue = (value) => String(value || '').trim().toLowerCase();

export const DOCTOR_ROLE_ALIASES = ['doctor', 'nurse'];
export const PATIENT_ROLE_ALIASES = ['user', 'patient'];
export const ADMIN_ROLE_ALIASES = ['admin'];

export const normalizeRole = (role) => {
    const normalizedRole = normalizeValue(role);

    if (normalizedRole === 'system_admin') {
        return 'system_admin';
    }

    if (ADMIN_ROLE_ALIASES.includes(normalizedRole)) {
        return 'admin';
    }

    if (DOCTOR_ROLE_ALIASES.includes(normalizedRole)) {
        return 'doctor';
    }

    if (PATIENT_ROLE_ALIASES.includes(normalizedRole)) {
        return 'user';
    }

    return null;
};

export const normalizeRoleList = (roles = []) =>
    Array.from(new Set(roles.map((role) => normalizeRole(role)).filter(Boolean)));

export const isDoctorRole = (role) => normalizeRole(role) === 'doctor';

export const isAdminRole = (role) => {
    const normalizedRole = normalizeRole(role);
    return normalizedRole === 'admin' || normalizedRole === 'system_admin';
};

export const isSystemAdminRole = (role) => normalizeRole(role) === 'system_admin';
