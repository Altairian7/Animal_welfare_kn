import { useApiQuery } from '../../hooks/useApiQuery';
import { API_BASE_URL } from '../../api/api';

export function useUserProfile() {
  return useApiQuery('user-profile', `${API_BASE_URL}/users/profile/me/`);
}

export function useAccountType() {
  return useApiQuery('user-account-type', `${API_BASE_URL}/users/profile/whoami/`);
}
