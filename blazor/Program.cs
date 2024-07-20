using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Blazor;
using Microsoft.AspNetCore.Components.WebAssembly.Authentication;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");

builder.RootComponents.Add<HeadOutlet>("head::after");
//builder.Services.AddAuthorizationCore();

//builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });

// builder.Services.AddHttpClient("WebAPI", 
//         client => client.BaseAddress = new Uri("https://localhost:7020"))
//     .AddHttpMessageHandler<BaseAddressAuthorizationMessageHandler>();

//builder.Services.AddTransient<CustomAuthorizationMessageHandler>();

// builder.Services.AddHttpClient("WebAPI",
//         client => client.BaseAddress = new Uri("https://northwind-api.casa-terraneo.workers.dev/api/"))
//     .AddHttpMessageHandler<CustomAuthorizationMessageHandler>();

// builder.Services.AddScoped(sp => sp.GetRequiredService<IHttpClientFactory>()
//     .CreateClient("WebAPI"));

//Non va
// builder.Services.AddScoped(sp => new HttpClient(
//     sp.GetRequiredService<AuthorizationMessageHandler>()
//     .ConfigureHandler(
//         authorizedUrls: new[] { "https://northwind-api.casa-terraneo.workers.dev/api/" },
//         scopes: new[] { "example.read", "example.write" }))
//     {
//         BaseAddress = new Uri("https://northwind-api.casa-terraneo.workers.dev/api/")
//     });


// builder.Services.AddHttpClient<EmployeeClient>(
//         client => client.BaseAddress = new Uri("https://northwind-api.casa-terraneo.workers.dev/api/"))
//     .AddHttpMessageHandler(sp => sp.GetRequiredService<AuthorizationMessageHandler>()
//     .ConfigureHandler(
//         authorizedUrls: new [] { "https://northwind-api.casa-terraneo.workers.dev/api/" },
//         scopes: new[] { "example.read", "example.write" }));

builder.Services.AddHttpClient("WebAPI",
        client => client.BaseAddress = new Uri("https://northwind-api.casa-terraneo.workers.dev/api/"))
    .AddHttpMessageHandler(sp => sp.GetRequiredService<AuthorizationMessageHandler>()
    .ConfigureHandler(
        authorizedUrls: new [] { "https://northwind-api.casa-terraneo.workers.dev/api/" }
        //,scopes: new[] { "example.read", "example.write" }
        ));

 builder.Services.AddScoped(sp => sp.GetRequiredService<IHttpClientFactory>()
     .CreateClient("WebAPI"));        

builder.Services.AddOidcAuthentication(options =>
{
    // Configure your authentication provider options here.
    // For more information, see https://aka.ms/blazor-standalone-auth
    builder.Configuration.Bind("Auth0", options.ProviderOptions);
    options.ProviderOptions.ResponseType = "code";
    //options.ProviderOptions.DefaultScopes.Add("https://myapi.example.com");
});

await builder.Build().RunAsync();
