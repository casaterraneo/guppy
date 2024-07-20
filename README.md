# guppy

https://learn.microsoft.com/en-us/aspnet/core/blazor/security/webassembly/standalone-with-authentication-library?view=aspnetcore-8.0&tabs=visual-studio

dotnet new blazorwasm -au Individual -o guppy-blazor
cd guppy-blazor
dotnet new gitignore
code .
 if you want guppy-blazor.sln and guppy-blazor.csproj files same folder
dotnet run

create Auth0 account
single page application
Allowed Callback URLs
Allowed Logout URLS

ClientId
Authority


dotnet run --urls "https://localhost:7020"
add on page
@using Microsoft.AspNetCore.Authorization
@attribute [Authorize]