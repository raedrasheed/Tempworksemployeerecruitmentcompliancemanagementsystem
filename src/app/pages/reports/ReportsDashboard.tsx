import { BarChart3, TrendingUp, Users, FileCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const monthlyData = [
  { month: 'Jan', applications: 12, approved: 10, rejected: 2 },
  { month: 'Feb', applications: 15, approved: 13, rejected: 2 },
  { month: 'Mar', applications: 18, approved: 15, rejected: 3 },
  { month: 'Apr', applications: 22, approved: 19, rejected: 3 },
  { month: 'May', applications: 25, approved: 22, rejected: 3 },
  { month: 'Jun', applications: 20, approved: 17, rejected: 3 },
];

const nationalityData = [
  { name: 'Poland', value: 35 },
  { name: 'Ukraine', value: 28 },
  { name: 'Romania', value: 22 },
  { name: 'Moldova', value: 15 },
];

const COLORS = ['#2563EB', '#22C55E', '#F59E0B', '#EF4444'];

export function ReportsDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#0F172A]">Reports & Analytics</h1>
        <p className="text-muted-foreground mt-1">Recruitment metrics and performance insights</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Applications</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-[#0F172A]">156</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-[#22C55E]">+12%</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approval Rate</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-[#22C55E]">87%</div>
            <p className="text-xs text-muted-foreground mt-1">Above target 85%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Processing Time</CardTitle>
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-[#2563EB]">45 days</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-[#22C55E]">-3 days</span> improvement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Documents Processed</CardTitle>
            <FileCheck className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-[#0F172A]">420</div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Application Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid key="grid" strokeDasharray="3 3" />
                <XAxis key="xaxis" dataKey="month" />
                <YAxis key="yaxis" />
                <Tooltip key="tooltip" />
                <Bar key="bar-applications" dataKey="applications" fill="#2563EB" />
                <Bar key="bar-approved" dataKey="approved" fill="#22C55E" />
                <Bar key="bar-rejected" dataKey="rejected" fill="#EF4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Drivers by Nationality</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={nationalityData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {nationalityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}