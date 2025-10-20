// src/components/Dashboard.js
import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  Award, 
  Clock, 
  Brain, 
  Target, 
  Zap, 
  BookOpen, 
  Activity,
  Calendar,
  Trophy,
  Flame,
  ChevronRight,
  Star,
  BarChart3,
  FileText,
  Play,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Sparkles
} from 'lucide-react';
import API_URL from '../apiConfig';


// Quick Action Card Component
const QuickActionCard = ({ icon: Icon, title, description, color, onClick, delay }) => (
  <div 
    onClick={onClick}
    className="group relative cursor-pointer animate-in slide-in-from-bottom"
    style={{ animationDelay: `${delay}ms`, animationDuration: '500ms' }}
  >
    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
    <div className="relative bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl p-6 rounded-2xl border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">
      <div className={`p-4 bg-gradient-to-br ${color} rounded-xl w-fit mb-4 group-hover:scale-110 transition-transform duration-300`}>
        <Icon className="w-8 h-8 text-white" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
      <div className="mt-4 flex items-center text-blue-400 text-sm font-semibold group-hover:gap-2 transition-all duration-300">
        <span>Get Started</span>
        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
      </div>
    </div>
  </div>
);

// Stat Card Component
const StatCard = ({ icon: Icon, title, value, change, changeType, color, delay }) => (
  <div 
    className="group relative animate-in slide-in-from-bottom"
    style={{ animationDelay: `${delay}ms`, animationDuration: '500ms' }}
  >
    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
    <div className="relative bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl p-6 rounded-2xl border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-1">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 bg-gradient-to-br ${color} rounded-xl`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {change && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${
            changeType === 'up' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {changeType === 'up' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {change}
          </div>
        )}
      </div>
      <div>
        <div className="text-3xl font-black text-white mb-1">{value}</div>
        <div className="text-sm text-gray-400">{title}</div>
      </div>
    </div>
  </div>
);

// Recent Activity Item
const ActivityItem = ({ icon: Icon, title, subtitle, time, color }) => (
  <div className="flex items-center gap-4 p-4 bg-gray-800/40 rounded-xl border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300 hover:-translate-y-1">
    <div className={`p-3 bg-gradient-to-br ${color} rounded-xl`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div className="flex-1">
      <h4 className="text-white font-semibold">{title}</h4>
      <p className="text-gray-400 text-sm">{subtitle}</p>
    </div>
    <span className="text-gray-500 text-xs">{time}</span>
  </div>
);

// Main Dashboard Component
function Dashboard({ userName }) {
  const [stats, setStats] = useState({
    testsCompleted: 0,
    averageScore: 0,
    totalQuestions: 0,
    studyStreak: 0,
    loading: true
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    // Set greeting based on time
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 17) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');

    // Fetch user stats
    fetchUserStats();
  }, []);

  const fetchUserStats = async () => {
    try {
      const token = localStorage.getItem('idToken');
      const userName = localStorage.getItem('userName');

      if (!token || !userName) {
        setStats(prev => ({ ...prev, loading: false }));
        return;
      }

      const response = await fetch(`${API_URL}/get-user-analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, userName })
      });

      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const results = data.results;
        let totalCorrect = 0;
        let totalQuestions = 0;

        results.forEach(result => {
          if (result.paper_details && result.paper_details.question_number) {
            const questionCount = result.paper_details.question_number.length;
            totalQuestions += questionCount;

            const options = result.paper_details.options;
            const correctAnswers = result.paper_details.correct_answer;

            for (let index = 0; index < questionCount; index++) {
              const userAnswer = result.answers[index.toString()];
              const correctKey = correctAnswers[index];
              const correctValue = options[index] ? options[index][correctKey] : null;

              if (userAnswer === correctValue) {
                totalCorrect += 1;
              }
            }
          }
        });

        const averageScore = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

        // Calculate study streak (simplified)
        const studyStreak = calculateStudyStreak(results);

        setStats({
          testsCompleted: results.length,
          averageScore,
          totalQuestions,
          studyStreak,
          loading: false
        });

        // Set recent activity
        const activities = results
          .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
          .slice(0, 5)
          .map((result, index) => {
            const score = calculateScore(result);
            return {
              icon: FileText,
              title: `Completed Test #${results.length - index}`,
              subtitle: `Score: ${score.percentage}% | ${score.score}/${score.total} correct`,
              time: formatTimeAgo(result.completed_at),
              color: score.percentage >= 70 ? 'from-green-500/20 to-green-600/20' : 'from-red-500/20 to-red-600/20'
            };
          });

        setRecentActivity(activities);
      } else {
        setStats(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      setStats(prev => ({ ...prev, loading: false }));
    }
  };

  const calculateScore = (result) => {
    if (!result.paper_details || !result.answers) return { score: 0, total: 0, percentage: 0 };
    
    const options = result.paper_details.options;
    const correctAnswers = result.paper_details.correct_answer;
    const totalQuestions = result.paper_details.question_number?.length || 0;
    let score = 0;

    for (let index = 0; index < totalQuestions; index++) {
      const userAnswer = result.answers[index.toString()];
      const correctKey = correctAnswers[index];
      const correctValue = options[index] ? options[index][correctKey] : null;
      
      if (userAnswer === correctValue) {
        score += 1;
      }
    }

    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
    return { score, total: totalQuestions, percentage };
  };

  const calculateStudyStreak = (results) => {
    if (results.length === 0) return 0;
    
    const dates = results
      .map(r => new Date(r.completed_at).toDateString())
      .filter((date, index, self) => self.indexOf(date) === index)
      .sort((a, b) => new Date(b) - new Date(a));

    let streak = 0;
    const today = new Date().toDateString();
    
    for (let i = 0; i < dates.length; i++) {
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - i);
      
      if (dates[i] === expectedDate.toDateString()) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const quickActions = [
    {
      icon: Play,
      title: 'Start New Test',
      description: 'Begin a new practice test session',
      color: 'from-blue-500/20 to-blue-600/20',
      onClick: () => alert('Navigate to test selection')
    },
    {
      icon: BookOpen,
      title: 'Study Materials',
      description: 'Access your learning resources',
      color: 'from-purple-500/20 to-purple-600/20',
      onClick: () => alert('Navigate to study materials')
    },
    {
      icon: BarChart3,
      title: 'View Analytics',
      description: 'Check your performance insights',
      color: 'from-pink-500/20 to-pink-600/20',
      onClick: () => alert('Navigate to analytics')
    },
    {
      icon: Calendar,
      title: 'Study Schedule',
      description: 'Plan your study sessions',
      color: 'from-green-500/20 to-green-600/20',
      onClick: () => alert('Navigate to schedule')
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-white p-6 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_80%)]"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Welcome Section */}
        <div className="mb-12 animate-in fade-in slide-in-from-top" style={{ animationDuration: '700ms' }}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-full backdrop-blur-sm">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-blue-300 font-medium">{greeting}</span>
                </div>
                {stats.studyStreak > 0 && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-full backdrop-blur-sm">
                    <Flame className="w-4 h-4 text-orange-400" />
                    <span className="text-sm text-orange-300 font-medium">{stats.studyStreak} Day Streak</span>
                  </div>
                )}
              </div>
              <h1 className="text-5xl md:text-6xl font-black mb-3">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                  Welcome Back!
                </span>
              </h1>
              <p className="text-2xl text-gray-300 font-semibold">{userName}</p>
              <p className="text-gray-400 mt-2">Ready to continue your learning journey?</p>
            </div>

            {/* Quick Stats Badge */}
            <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl p-6 rounded-3xl border border-gray-700/50">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-2xl">
                  <Trophy className="w-8 h-8 text-yellow-400" />
                </div>
                <div>
                  <div className="text-3xl font-black text-white">{stats.averageScore}%</div>
                  <div className="text-sm text-gray-400">Average Score</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatCard 
            icon={Target} 
            title="Tests Completed" 
            value={stats.testsCompleted}
            change="12%"
            changeType="up"
            color="from-blue-500/20 to-blue-600/20"
            delay={0}
          />
          <StatCard 
            icon={CheckCircle} 
            title="Questions Solved" 
            value={stats.totalQuestions}
            change="8%"
            changeType="up"
            color="from-green-500/20 to-green-600/20"
            delay={100}
          />
          <StatCard 
            icon={TrendingUp} 
            title="Average Score" 
            value={`${stats.averageScore}%`}
            change="5%"
            changeType="up"
            color="from-purple-500/20 to-purple-600/20"
            delay={200}
          />
          <StatCard 
            icon={Flame} 
            title="Study Streak" 
            value={`${stats.studyStreak} Days`}
            color="from-orange-500/20 to-red-600/20"
            delay={300}
          />
        </div>

        {/* Quick Actions */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-400" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {quickActions.map((action, index) => (
              <QuickActionCard
                key={index}
                icon={action.icon}
                title={action.title}
                description={action.description}
                color={action.color}
                onClick={action.onClick}
                delay={index * 100}
              />
            ))}
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity - Takes 2 columns */}
          <div className="lg:col-span-2 bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl p-6 rounded-3xl border border-gray-700/50">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Activity className="w-6 h-6 text-blue-400" />
              Recent Activity
            </h2>
            <div className="space-y-3">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity, index) => (
                  <ActivityItem
                    key={index}
                    icon={activity.icon}
                    title={activity.title}
                    subtitle={activity.subtitle}
                    time={activity.time}
                    color={activity.color}
                  />
                ))
              ) : (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-800/50 rounded-full mb-4 border border-gray-700/50">
                    <Activity className="w-8 h-8 text-gray-600" />
                  </div>
                  <p className="text-gray-400">No recent activity</p>
                  <p className="text-gray-500 text-sm mt-2">Start a test to see your activity here</p>
                </div>
              )}
            </div>
          </div>

          {/* Performance Summary - Takes 1 column */}
          <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl p-6 rounded-3xl border border-gray-700/50">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Star className="w-6 h-6 text-yellow-400" />
              Today's Goals
            </h2>
            <div className="space-y-4">
              {/* Goal Item */}
              <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-semibold text-sm">Complete 1 Test</span>
                  <span className="text-gray-400 text-xs">0/1</span>
                </div>
                <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full" style={{ width: '0%' }}></div>
                </div>
              </div>

              <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-semibold text-sm">Solve 20 Questions</span>
                  <span className="text-gray-400 text-xs">0/20</span>
                </div>
                <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full" style={{ width: '0%' }}></div>
                </div>
              </div>

              <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-semibold text-sm">Study for 30 mins</span>
                  <span className="text-gray-400 text-xs">0/30</span>
                </div>
                <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full" style={{ width: '0%' }}></div>
                </div>
              </div>

              {/* Motivational Quote */}
              <div className="mt-6 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl">
                <p className="text-blue-300 text-sm italic">
                  "Success is the sum of small efforts repeated day in and day out."
                </p>
                <p className="text-gray-500 text-xs mt-2">- Robert Collier</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recommendations Section */}
        <div className="mt-12 bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl p-6 rounded-3xl border border-gray-700/50">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-400" />
            Recommended For You
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-800/40 p-6 rounded-2xl border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-1 cursor-pointer">
              <div className="p-3 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl w-fit mb-4">
                <FileText className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Practice Test #12</h3>
              <p className="text-gray-400 text-sm mb-4">50 Questions • Medium Difficulty</p>
              <button className="w-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-semibold py-2 px-4 rounded-xl transition-colors duration-200 border border-blue-500/30">
                Start Test
              </button>
            </div>

            <div className="bg-gray-800/40 p-6 rounded-2xl border border-gray-700/50 hover:border-purple-500/50 transition-all duration-300 hover:-translate-y-1 cursor-pointer">
              <div className="p-3 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl w-fit mb-4">
                <BookOpen className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Weak Areas Review</h3>
              <p className="text-gray-400 text-sm mb-4">Focus on your improvement areas</p>
              <button className="w-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 font-semibold py-2 px-4 rounded-xl transition-colors duration-200 border border-purple-500/30">
                Review Now
              </button>
            </div>

            <div className="bg-gray-800/40 p-6 rounded-2xl border border-gray-700/50 hover:border-green-500/50 transition-all duration-300 hover:-translate-y-1 cursor-pointer">
              <div className="p-3 bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl w-fit mb-4">
                <Trophy className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Challenge Mode</h3>
              <p className="text-gray-400 text-sm mb-4">Test your skills with hard questions</p>
              <button className="w-full bg-green-500/20 hover:bg-green-500/30 text-green-400 font-semibold py-2 px-4 rounded-xl transition-colors duration-200 border border-green-500/30">
                Take Challenge
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
