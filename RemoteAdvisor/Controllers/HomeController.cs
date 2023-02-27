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
            string meetingid = Guid.NewGuid().ToString();
            if (id == "")
            {
                id = meetingid;
            }   
            ViewBag.MeetingId = id;
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