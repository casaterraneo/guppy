using System;
using System.Collections.Generic;

public record GuppyUser
{
    public DateTime created_at { get; init; }
    public string email { get; init; } = string.Empty;
    public bool email_verified { get; init; }
    public List<Identity> identities { get; init; } = new();
    public string name { get; init; } = string.Empty;
    public string nickname { get; init; } = string.Empty;
    public string picture { get; init; } = string.Empty;
    public DateTime updated_at { get; init; }
    public string user_id { get; init; } = string.Empty;
    public DateTime? last_password_reset { get; init; }
    public UserMetadata? user_metadata { get; init; }
    public AppMetadata? app_metadata { get; init; }
    public string last_ip { get; init; } = string.Empty;
    public DateTime last_login { get; init; }
    public int logins_count { get; init; }
}

public record Identity
{
    public string connection { get; init; } = string.Empty;
    public string provider { get; init; } = string.Empty;
    public string user_id { get; init; } = string.Empty;
    public bool isSocial { get; init; }
}

public record UserMetadata
{
    public string favorite_color { get; init; } = string.Empty;
}

public record AppMetadata
{
    public string company_name { get; init; } = string.Empty;
}
