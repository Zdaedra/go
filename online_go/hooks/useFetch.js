import { useState, useEffect } from 'react';

export default function useFetch(url, filters) {
  const [data, setData] = useState([]);
  const [loading, setLoading] =useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(url, { 
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(filters),
    })
    .then(response => response.json())
    .then(data => {
      setData(data);
      setLoading(false);
    })
    .catch(error => {
      setError(error);
      setLoading(false);
    });  
  }, [url, filters]);

  return { data, loading, error };
}