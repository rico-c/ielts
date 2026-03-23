import { useState, useEffect } from 'react';

interface MembershipStatus {
  isVip: boolean;
  expiryDate?: number;
  plan?: string;
  subscriptionId?: string;
  loading: boolean;
  error?: any;
}

export function useMembership(): MembershipStatus {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchMembership() {
      try {
        const res = await fetch('/api/user/membership');
        if (!res.ok) {
          throw new Error('Failed to fetch membership');
        }
        const json = await res.json();
        if (mounted) {
          setData(json);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err);
          setLoading(false);
        }
      }
    }

    fetchMembership();

    return () => {
      mounted = false;
    };
  }, []);

  return {
    isVip: data?.isVip || false,
    expiryDate: data?.expiryDate,
    plan: data?.plan,
    subscriptionId: data?.subscriptionId,
    loading,
    error,
  };
}
