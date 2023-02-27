using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace RemoteAdvisor.Models
{
    public static class Extensions
    {
        #region ToACSNumber
        //convert cell to upn
        //dependency on a +1 Country Code
        //Also, ACS does not support () or - in the number
        public static string ToACSNumber(this string cell)
        {
            if (cell == null)
                return null;
            if (cell.StartsWith("+1"))
                return cell;
            string upn = "+1" + cell.Replace("(", "").Replace(")", "").Replace("-", "").Replace(" ", "").Trim();
            return upn;
        }
        #endregion
    }
}