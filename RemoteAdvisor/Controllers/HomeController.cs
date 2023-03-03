using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace RemoteAdvisor.Controllers
{
    public class HomeController : Controller
    {
        public ActionResult Index(string id = "")
        {
            string meetingid = Guid.Parse("cccccd0c-6578-48ce-a064-ee7ead66a9ad").ToString();
            bool hasId = true;
            if (id == "")
            {
                id = meetingid;
                hasId = false;
            }   
            ViewBag.MeetingId = id;
            ViewBag.HasId = hasId;
            return View();
        }
        public ActionResult TestPage()
        {
            return View();
        }
        public ActionResult Helper()
        {
            return View();
        }
    }
}