using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace RemoteAdvisor.Models
{
    public class SmsRequest
    {
        public string ToName { get; set; }
        public string ToCellNumber { get; set; }
        public string Message { get; set; }
        public string MeetingId { get; set; }
        public string Tag { get; set; } = "general";
    }
}