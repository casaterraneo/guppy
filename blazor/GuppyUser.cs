public record GuppyUser
{
    public DateTime CreatedAt { get; init; }
    public string Email { get; init; } = string.Empty;
    public bool EmailVerified { get; init; }
    public List<Identity> Identities { get; init; } = new();
    public string Name { get; init; } = string.Empty;
    public string Nickname { get; init; } = string.Empty;
    public string Picture { get; init; } = string.Empty;
    public DateTime UpdatedAt { get; init; }
    public string UserId { get; init; } = string.Empty;
    public DateTime? LastPasswordReset { get; init; }
    public UserMetadata? UserMetadata { get; init; }
    public AppMetadata? AppMetadata { get; init; }
    public string LastIp { get; init; } = string.Empty;
    public DateTime LastLogin { get; init; }
    public int LoginsCount { get; init; }
}

public record Identity
{
    public string Connection { get; init; } = string.Empty;
    public string Provider { get; init; } = string.Empty;
    public string UserId { get; init; } = string.Empty;
    public bool IsSocial { get; init; }
}

public record UserMetadata
{
    public string FavoriteColor { get; init; } = string.Empty;
}

public record AppMetadata
{
    public string CompanyName { get; init; } = string.Empty;
}
