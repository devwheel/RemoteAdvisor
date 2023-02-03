using Azure.Communication;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace RemoteAdvisor.Models
{
    public class ACSUser
    {
        public CommunicationUserIdentifier AcsUserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
    }
}