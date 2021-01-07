using Azure.Communication;
using Azure.Communication.Administration;
using Azure.Communication.Administration.Models;
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
        string connectionString = "endpoint=xxxx get this from Azure";

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
                var identityResponse = await client.CreateUserAsync();
                var identity = identityResponse.Value;
                var tokenResponse = await client.IssueTokenAsync(identity, scopes: new[] { CommunicationTokenScope.VoIP });
                return Ok(tokenResponse.Value);
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
            var identitytoRefresh = new CommunicationUser(request.UserEmail);
            var tokenResponse = await client.IssueTokenAsync(identitytoRefresh, scopes: new[] { CommunicationTokenScope.VoIP });
            return Ok(tokenResponse.Value);
        }

        [Route("api/acs/auth")]
        [HttpGet]
        public async Task<IHttpActionResult> GetTokenAsync()
        {
            var client = new CommunicationIdentityClient(connectionString);
            var identityResponse = await client.CreateUserAsync();
            var identity = identityResponse.Value;
            var tokenResponse = await client.IssueTokenAsync(identity, scopes: new[] { CommunicationTokenScope.VoIP });
            return Ok(tokenResponse.Value);
        }

    }

    //generic class for requesting a new token or refreshing one
    public class TokenRequest
    {
        public string UserId { get; set; } = "";
        public string UserEmail { get; set; } = "";
    }
}

