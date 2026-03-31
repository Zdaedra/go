import React, { useState } from 'react';

const Learn = () => {
  const [difficulty, setDifficulty] = useState<string>('all');

  return (
    <div>
      <h2>Learn Go</h2>
      <select onChange={(e) => setDifficulty(e.target.value)} value={difficulty}>
        <option value="all">All Levels</option>
        <option value="beginner">Beginner</option>
        <option value="intermediate">Intermediate</option>
        <option value="advanced">Advanced</option>
      </select>
      <div>
        {/* Replace with dynamic content fetched from the server */}
        <p>Displaying {difficulty} content...</p>
      </div>
    </div>
  );
};

export default Learn;