import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export default function Profile() {
  const { user } = useAuth();
  const { isDirector, isLoading: roleLoading } = useUserRole();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      if (error) throw error;
      
      setProfile(data);
      setFormData({ name: data.name || "" });
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          name: formData.name,
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id);

      if (error) throw error;

      // Update user metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { user_metadata: { name: formData.name } }
      });

      if (authError) throw authError;

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });

      setIsEditing(false);
      fetchProfile(); // Refresh profile data
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({ name: profile.name || "" });
    }
    setIsEditing(false);
  };

  if (isLoading || roleLoading) {
    return (
      <AppLayout title="Profile">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout title="Profile">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Profile not found</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Profile">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Profile Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-2xl">
                  {profile.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <CardTitle className="text-2xl">{profile.name}</CardTitle>
                <CardDescription>{profile.email}</CardDescription>
                <Badge variant={isDirector ? "default" : "secondary"}>
                  {isDirector ? "Director" : "Employee"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Member Since</Label>
                <p>{new Date(profile.created_at).toLocaleDateString()}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Last Updated</Label>
                <p>{new Date(profile.updated_at).toLocaleDateString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Profile */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Edit Profile</CardTitle>
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)}>Edit</Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave}>Save</Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              {isEditing ? (
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter your name"
                />
              ) : (
                <p className="text-sm">{profile.name || "No name set"}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Badge variant={isDirector ? "default" : "secondary"}>
                {isDirector ? "Director" : "Employee"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Account Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Account Actions</CardTitle>
            <CardDescription>Manage your account settings and preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full justify-start">
              Change Password
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Export Data
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Privacy Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
