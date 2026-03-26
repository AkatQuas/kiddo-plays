/**
 * Profile Component - Exposed via Module Federation
 * User profile page with account settings
 */

import { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Badge } from '@mf-monorepo/ui';
import { User, Mail, Package, Heart, Settings, Save } from 'lucide-react';

interface UserProfile {
  name: string;
  email: string;
  avatar: string;
  joinedAt: string;
  orders: number;
}

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile>({
    name: 'John Doe',
    email: 'john@example.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
    joinedAt: 'January 2024',
    orders: 12,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(profile);

  const handleSave = () => {
    setProfile(formData);
    setIsEditing(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <img
              src={profile.avatar}
              alt={profile.name}
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                border: '3px solid #e5e7eb',
              }}
            />
            <div style={{ flex: 1 }}>
              <CardTitle style={{ fontSize: '1.5rem' }}>{profile.name}</CardTitle>
              <p style={{ color: '#6b7280', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Mail size={14} />
                {profile.email}
              </p>
            </div>
            <Badge variant="secondary">Member since {profile.joinedAt}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
              <Package size={24} style={{ margin: '0 auto 0.5rem', color: '#6b7280' }} />
              <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>{profile.orders}</p>
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Orders</p>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
              <Heart size={24} style={{ margin: '0 auto 0.5rem', color: '#6b7280' }} />
              <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>5</p>
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Wishlist</p>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
              <Settings size={24} style={{ margin: '0 auto 0.5rem', color: '#6b7280' }} />
              <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>2</p>
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Settings</p>
            </div>
          </div>

          <Card style={{ marginTop: '1.5rem' }}>
            <CardHeader>
              <CardTitle style={{ fontSize: '1.125rem' }}>Account Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label
                    style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}
                  >
                    Full Name
                  </label>
                  <Input
                    name="name"
                    value={isEditing ? formData.name : profile.name}
                    onChange={handleChange}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <label
                    style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}
                  >
                    Email
                  </label>
                  <Input
                    name="email"
                    type="email"
                    value={isEditing ? formData.email : profile.email}
                    onChange={handleChange}
                    disabled={!isEditing}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {isEditing ? (
                    <>
                      <Button onClick={handleSave}>
                        <Save size={16} style={{ marginRight: '0.25rem' }} />
                        Save Changes
                      </Button>
                      <Button variant="outline" onClick={() => setIsEditing(false)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => setIsEditing(true)}>
                      <User size={16} style={{ marginRight: '0.25rem' }} />
                      Edit Profile
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
