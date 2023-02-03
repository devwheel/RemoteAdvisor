using Azure.Communication;
using Azure.Communication.Identity;
using RemoteAdvisor.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web.Http;

namespace RemoteAdvisor.Controllers
{
    public class ACSAuthController : ApiController
    {
        //Connection string to the ACS instance
        string connectionString = System.Configuration.ConfigurationManager.AppSettings["ACS.ConnectionString"];

        /// <summary>
        /// Create an ACS User and get a token
        /// </summary>
        /// <param name="request"></param>
        /// <returns></returns>
        [Route("api/ACS/AuthGet")]
        [HttpPost]
        public async Task<IHttpActionResult> ACSGetAsync(TokenRequest request)
        {
            try
            {
                var client = new CommunicationIdentityClient(connectionString);
                string token = string.Empty;
                CommunicationUserIdentifier identity = null;
                DateTimeOffset expires = DateTime.UtcNow;
               // if (request.User.AcsUserId == null)
               // {
                    var identityResponse = await client.CreateUserAsync();
                    request.User.AcsUserId = identityResponse.Value;
                    identity = identityResponse.Value;
               // }
                //check for token expiration
                var tokenResponse = await client.GetTokenAsync(identity, scopes: new[] { CommunicationTokenScope.VoIP });
                    token = tokenResponse.Value.Token.ToString();
                    expires = tokenResponse.Value.ExpiresOn;
                
                TokenRequestResponse response = new TokenRequestResponse() { AcsUser = request.User, Token = token, TokenExpires = expires };
                return Ok(response);
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex.Message);
                throw ex;
            }
        }
        /// <summary>
        /// Refresh the token for an ACS User
        /// </summary>
        /// <param name="request"></param>
        /// <returns></returns>
        [Route("api/ACS/AuthRefresh")]
        [HttpPost]
        public async Task<IHttpActionResult> ACSRefreshAsync(TokenRequest request)
        {
            var client = new CommunicationIdentityClient(connectionString);
            var identitytoRefresh = new CommunicationUserIdentifier(request.User.Email);
            var tokenResponse = await client.GetTokenAsync(identitytoRefresh, scopes: new[] { CommunicationTokenScope.VoIP });
            return Ok(tokenResponse.Value);
        }

        [Route("api/acs/auth")]
        [HttpGet]
        public async Task<IHttpActionResult> GetTokenAsync()
        {
            var client = new CommunicationIdentityClient(connectionString);
            var identityResponse = await client.CreateUserAsync();
            var identity = identityResponse.Value;
            var tokenResponse = await client.GetTokenAsync
                (identity, scopes: new[] { CommunicationTokenScope.VoIP });
            return Ok(tokenResponse.Value.Token);
        }

    }

    //generic class for requesting a new token or refreshing one
    public class TokenRequest
    {
        public ACSUser User { get; set; } = new ACSUser();
        public string Token { get; set; }
        public DateTimeOffset TokenExpires { get; set; }
    }
}

