import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';

const CustomAgentContext = createContext();

export const CustomAgentProvider = ({ children }) => {
  const [agentUser, setAgentUser] = useState(() => {
    const saved = localStorage.getItem('rayzon_agent_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [assignedBls, setAssignedBls] = useState(() => {
    const saved = localStorage.getItem('rayzon_agent_bls');
    return saved ? JSON.parse(saved) : [];
  });

  const fetchAssignedBls = useCallback(async (agentId) => {
    try {
      const res = await apiFetch('/api/p2p/customs-agent/assigned');
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Unable to load BL assignments.');
      setAssignedBls(json.assignments || []);
      localStorage.setItem('rayzon_agent_bls', JSON.stringify(json.assignments || []));
      return json.assignments || [];
    } catch (e) {
      console.warn('[AGENT PORTAL FETCH WARN]', e.message);
      throw e;
    }
  }, []);

  useEffect(() => {
    if (agentUser?.isLoggedIn) {
      fetchAssignedBls(agentUser.agentId).catch(() => {});
    }
  }, [agentUser?.isLoggedIn, fetchAssignedBls]);

  const loginAgent = async (email, password) => {
    setAssignedBls([]);
    localStorage.removeItem('rayzon_agent_bls');

    const res = await apiFetch('/api/custom-agents/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Login failed. Please verify your credentials.');
    }

    const user = {
      ...json.agent,
      isLoggedIn: true,
      loginTime: new Date().toISOString()
    };

    setAgentUser(user);
    if (json.token) {
      localStorage.setItem('rayzon_agent_token', json.token);
    }
    localStorage.setItem('rayzon_agent_user', JSON.stringify(user));

    await fetchAssignedBls(json.agent.agentId);
    return user;
  };

  const logoutAgent = () => {
    setAgentUser(null);
    setAssignedBls([]);
    localStorage.removeItem('rayzon_agent_user');
    localStorage.removeItem('rayzon_agent_token');
    localStorage.removeItem('rayzon_agent_bls');
  };

  const uploadBoe = async (blId, boeData) => {
    try {
      const res = await apiFetch('/api/p2p/customs-agent/upload-boe', {
        method: 'POST',
        body: JSON.stringify({
          blId,
          ...boeData
        })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        await fetchAssignedBls(agentUser?.agentId);
        return json;
      }
      throw new Error(json.error || 'Failed to upload BOE');
    } catch (err) {
      throw err;
    }
  };

  const markAsCleared = async (blId, notes = '') => {
    try {
      const res = await apiFetch('/api/p2p/customs-agent/clear', {
        method: 'POST',
        body: JSON.stringify({ blId, notes })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        await fetchAssignedBls(agentUser?.agentId);
        return json;
      }
      throw new Error(json.error || 'Failed to mark as cleared');
    } catch (err) {
      throw err;
    }
  };

  const fetchAssignedBl = async (blId) => {
    const res = await apiFetch(`/api/p2p/customs-agent/assigned/${blId}`);
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Unable to load the assigned BL.');
    return json.data;
  };

  const uploadCustomsDocument = async (blId, document) => {
    const res = await apiFetch('/api/p2p/customs-agent/documents', { method: 'POST', body: JSON.stringify({ blId, ...document }) });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Customs document upload failed.');
    await fetchAssignedBls(agentUser?.agentId);
    return json.data;
  };

  const changePassword = async (currentPassword, newPassword) => {
    const agentId = agentUser?.agentId;
    const email = agentUser?.email;

    const res = await apiFetch('/api/custom-agents/change-password', {
      method: 'POST',
      body: JSON.stringify({
        agentId,
        email,
        currentPassword,
        newPassword
      })
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to update password.');
    }
    return json;
  };

  const submitAgentInvoice = async (blId, invoiceData) => {
    const res = await apiFetch('/api/p2p/customs-agent/invoices', {
      method: 'POST',
      body: JSON.stringify({ blId, ...invoiceData })
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Agent invoice submission failed.');
    await fetchAssignedBls(agentUser?.agentId);
    return json.data;
  };

  return (
    <CustomAgentContext.Provider
      value={{
        agentUser,
        assignedBls,
        loginAgent,
        logoutAgent,
        uploadBoe,
        markAsCleared,
        fetchAssignedBl,
        uploadCustomsDocument,
        submitAgentInvoice,
        changePassword,
        fetchAssignedBls
      }}
    >
      {children}
    </CustomAgentContext.Provider>
  );
};

export const useCustomAgent = () => {
  const context = useContext(CustomAgentContext);
  if (!context) {
    throw new Error('useCustomAgent must be used within a CustomAgentProvider');
  }
  return context;
};
