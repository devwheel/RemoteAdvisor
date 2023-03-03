using Azure.Communication.Sms;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Web;

namespace RemoteAdvisor.Models
{
    public class SmsProvider
    {
        private string _acsPhoneNumber = System.Configuration.ConfigurationManager.AppSettings["ACS.SMS.From"];

        public async Task<SmsSendResult> SendSMSAsync(string to, string message, string tag = "general")
        {
            // This code retrieves your connection string
            // from an environment variable.
            string connectionString = System.Configuration.ConfigurationManager.ConnectionStrings["ACSSecurity"].ConnectionString;

            SmsClient smsClient = new SmsClient(connectionString);
            SmsSendResult sendResult = await smsClient.SendAsync(
                                        from: _acsPhoneNumber,
                                        to: to,
                                        message: message,
                                        options: new SmsSendOptions(enableDeliveryReport: true)
                                        {
                                            Tag = tag
                                        }
                                    );
            return sendResult;

        }
        public async Task<SmsSendResult> SendMeetingInviteAsync(string toCell, string toName, string meetingId)
        {
            try
            {
                // This code retrieves your connection string
                // from an environment variable.
                string connectionString = System.Configuration.ConfigurationManager.AppSettings["ACS.ConnectionString"];
                string message = $"Hi {toName}, you have been invited to a virtual session at https://remoteadvisor.azurewebsites.net?id={meetingId}";
                SmsClient smsClient = new SmsClient(connectionString);
                SmsSendResult sendResult = await smsClient.SendAsync(
                                            from: _acsPhoneNumber,
                                            to: toCell.ToACSNumber(),
                                            message: message,
                                            options: new SmsSendOptions(enableDeliveryReport: true)
                                            {
                                                Tag = "RemoteAdvisor"
                                            }
                                        );
                return sendResult;
            }
            catch( Exception ex ) { throw new Exception(ex.Message); }
        }

    }
}