using RemoteAdvisor.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web.Http;
using System.Web.Http.Description;

namespace RemoteAdvisor.Controllers
{
    public class SMSController : ApiController
    {

        #region SendSMS
        [Route("api/sms/invite")]
        [HttpPost]
        [ApiExplorerSettings(IgnoreApi = true)]

        public async Task<IHttpActionResult> SendAcsSMS(SmsRequest request)
        {
            SmsProvider provider = new SmsProvider();
            var response = await provider.SendMeetingInviteAsync(request.ToCellNumber.ToACSNumber(), request.ToName, request.MeetingId);
            return Ok(response);
        }
        #endregion
    }
}
