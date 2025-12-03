export const mockDashboardStats = {
  totalRecords: 2_000_000,
  collectionsCount: 20,
  recentInserts: 1_250,
  recentUpdates: 890,
  topDoctors: [
    { name: "Dr. Smith", appointments: 245 },
    { name: "Dr. Johnson", appointments: 198 },
    { name: "Dr. Williams", appointments: 176 },
    { name: "Dr. Brown", appointments: 154 },
    { name: "Dr. Davis", appointments: 132 },
  ],
  genderDistribution: [
    { gender: "Male", count: 52_000, fill: "hsl(var(--chart-1))" },
    { gender: "Female", count: 48_000, fill: "hsl(var(--chart-2))" },
  ],
  departmentLoads: [
    { department: "Cardiology", count: 18_500 },
    { department: "Neurology", count: 15_200 },
    { department: "Orthopedics", count: 14_800 },
    { department: "Pediatrics", count: 12_300 },
    { department: "Emergency", count: 21_000 },
  ],
  billingTotals: [
    { method: "Cash", total: 2_500_000 },
    { method: "Card", total: 3_200_000 },
    { method: "Insurance", total: 4_100_000 },
  ],
  monthlyAppointments: [
    { month: "Jan", count: 8_500 },
    { month: "Feb", count: 7_800 },
    { month: "Mar", count: 9_200 },
    { month: "Apr", count: 8_900 },
    { month: "May", count: 10_200 },
    { month: "Jun", count: 11_500 },
  ],
  testResults: [
    { result: "Normal", count: 65_000, fill: "hsl(var(--success))" },
    { result: "Abnormal", count: 35_000, fill: "hsl(var(--destructive))" },
  ],
};
