// src/components/Dashboard.js
import React from 'react';

// The userName prop will be passed from App.js after a successful login
function Dashboard({ userName }) {
  return (
    <div className="flex justify-center items-center py-20">
      <div className="text-center p-8 bg-gray-800 rounded-lg shadow-xl animate-fade-in">
        <h1 className="text-4xl font-bold text-white">Welcome to Your Dashboard!</h1>
        <p className="text-2xl mt-4 text-indigo-400">{userName}</p>
        <p className="mt-6 text-gray-300">This is your secure, logged-in area.</p>
      </div>
    </div>
  );
}

export default Dashboard;