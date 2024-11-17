public class GuppyUser
{
    public DateTime created_at { get; set; }
    public string email { get; set; } = string.Empty;
    public bool email_verified { get; set; }
    public List<Identity> identities { get; set; } = new();
    public string name { get; set; } = string.Empty;
    public string nickname { get; set; } = string.Empty;
    public string picture { get; set; } = string.Empty;
    public DateTime updated_at { get; set; }
    public string user_id { get; set; } = string.Empty;
    public DateTime? last_password_reset { get; set; }
    public UserMetadata? user_metadata { get; set; }
    public AppMetadata? app_metadata { get; set; }
    public string last_ip { get; set; } = string.Empty;
    public DateTime last_login { get; set; }
    public int logins_count { get; set; }
}

public class Identity
{
    public string connection { get; set; } = string.Empty;
    public string provider { get; set; } = string.Empty;
    public string user_id { get; set; } = string.Empty;
    public bool isSocial { get; set; }
}

public class UserMetadata
{
    public string favorite_color { get; set; } = string.Empty;
}

public class AppMetadata
{
    public string company_name { get; set; } = string.Empty;
}
