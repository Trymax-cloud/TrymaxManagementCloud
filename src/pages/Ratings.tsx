import { useState } from "react";
import { format, parse } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMyRatings, useAllRatings } from "@/hooks/useRatings";
import { useProfiles } from "@/hooks/useProfiles";
import { useUserRole } from "@/hooks/useUserRole";
import { CreateRatingModal } from "@/components/ratings/CreateRatingModal";
import { RatingCard } from "@/components/ratings/RatingCard";
import { Star, Plus, TrendingUp, Calendar, Users, Search } from "lucide-react";

export default function Ratings() {
  const { isDirector } = useUserRole();
  const { data: myRatings, isLoading: myRatingsLoading } = useMyRatings();
  const { data: allRatings, isLoading: allRatingsLoading } = useAllRatings();
  const { data: profiles } = useProfiles();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const getProfileName = (userId: string) => {
    return profiles?.find(p => p.id === userId)?.name || "Unknown";
  };

  const filteredAllRatings = allRatings?.filter(rating => {
    const periodMatch = periodFilter === "all" || rating.period_type === periodFilter;
    const profileName = getProfileName(rating.user_id).toLowerCase();
    const searchMatch = profileName.includes(searchQuery.toLowerCase());
    return periodMatch && searchMatch;
  });

  const calculateAverageRating = (ratings: typeof myRatings) => {
    if (!ratings || ratings.length === 0) return 0;
    const sum = ratings.reduce((acc, r) => acc + r.score, 0);
    return (sum / ratings.length).toFixed(1);
  };

  // Group ratings by employee for director view
  const ratingsByEmployee = filteredAllRatings?.reduce((acc, rating) => {
    if (!acc[rating.user_id]) {
      acc[rating.user_id] = [];
    }
    acc[rating.user_id].push(rating);
    return acc;
  }, {} as Record<string, typeof allRatings>);

  if (isDirector) {
    return (
      <AppLayout title="Employee Ratings">
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">
              Manage and review employee performance ratings
            </p>
            <Button className="gap-2" onClick={() => setCreateModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Submit Rating
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-0 shadow-soft">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Employees Rated</p>
                    <p className="text-2xl font-bold">
                      {Object.keys(ratingsByEmployee || {}).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-soft">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                    <Star className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Average Rating</p>
                    <p className="text-2xl font-bold">
                      {calculateAverageRating(allRatings)} / 5
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-soft">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Ratings</p>
                    <p className="text-2xl font-bold">{allRatings?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by employee name..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Periods</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ratings by Employee */}
          {allRatingsLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : !filteredAllRatings || filteredAllRatings.length === 0 ? (
            <Card className="border-0 shadow-soft">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Star className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">No ratings yet</h3>
                <p className="text-muted-foreground text-center max-w-sm">
                  Start rating employees to track their performance
                </p>
                <Button className="mt-4 gap-2" onClick={() => setCreateModalOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Submit First Rating
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(ratingsByEmployee || {}).map(([userId, ratings]) => (
                <div key={userId}>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {getProfileName(userId)}
                    <Badge variant="secondary" className="ml-2">
                      Avg: {calculateAverageRating(ratings)} / 5
                    </Badge>
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {ratings?.map((rating) => (
                      <RatingCard key={rating.id} rating={rating} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <CreateRatingModal open={createModalOpen} onOpenChange={setCreateModalOpen} />
        </div>
      </AppLayout>
    );
  }

  // Employee view
  return (
    <AppLayout title="My Ratings">
      <div className="space-y-6 animate-fade-in">
        <p className="text-muted-foreground">
          View your performance ratings and feedback
        </p>

        {/* Personal Stats */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-0 shadow-soft">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                  <Star className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Average Rating</p>
                  <p className="text-2xl font-bold">
                    {calculateAverageRating(myRatings)} / 5
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-soft">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Reviews</p>
                  <p className="text-2xl font-bold">{myRatings?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ratings Tabs */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Ratings</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly">Yearly</TabsTrigger>
          </TabsList>

          {myRatingsLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : !myRatings || myRatings.length === 0 ? (
            <Card className="border-0 shadow-soft">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Star className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">No ratings yet</h3>
                <p className="text-muted-foreground text-center max-w-sm">
                  Your performance ratings will appear here once your director submits them.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <TabsContent value="all" className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {myRatings.map((rating) => (
                    <RatingCard key={rating.id} rating={rating} />
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="monthly" className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {myRatings
                    .filter((r) => r.period_type === "monthly")
                    .map((rating) => (
                      <RatingCard key={rating.id} rating={rating} />
                    ))}
                </div>
              </TabsContent>
              <TabsContent value="yearly" className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {myRatings
                    .filter((r) => r.period_type === "yearly")
                    .map((rating) => (
                      <RatingCard key={rating.id} rating={rating} />
                    ))}
                </div>
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}
