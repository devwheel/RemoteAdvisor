using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace RemoteAdvisor.Models
{
    public class TokenRequestResponse
    {
        public ACSUser AcsUser { get; set; }
        public string Token { get; set; }
        public DateTimeOffset TokenExpires { get; set; } = DateTime.Now;
    }
}