export const logInteraction = async (interactionType, elementId) => {
  try {
    const response = await fetch('/api/log-interaction/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ interactionType, elementId }),
    });
    return response.json();
  } catch (error) {
    console.error('Error logging interaction:', error);
  }
};

export const logAccessibilityEvent = async (eventType, elementId) => {
  try {
    const response = await fetch('/api/log-accessibility-event/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ eventType, elementId }),
    });
    return response.json();
  } catch (error) {
    console.error('Error logging accessibility event:', error);
  }
};