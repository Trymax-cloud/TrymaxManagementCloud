// Test script to check meeting notifications
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabaseUrl = 'https://your-project.supabase.co';
const supabaseKey = 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testMeetingNotifications() {
  console.log('🔍 Testing meeting notifications...');
  
  try {
    // Get all notifications
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('type', 'meeting_created')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error('❌ Error fetching notifications:', error);
      return;
    }
    
    console.log('📋 Meeting notifications found:', notifications?.length || 0);
    notifications?.forEach((notif, index) => {
      console.log(`📅 Notification ${index + 1}:`, {
        id: notif.id,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        user_id: notif.user_id,
        is_read: notif.is_read,
        created_at: notif.created_at
      });
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testMeetingNotifications();
