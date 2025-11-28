import React, { useContext } from 'react'
import Login from './pages/Login.jsx';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AdminContext } from './context/AdminContext';
import Navbar from './components/Navbar.jsx';
import Sidebar from './components/Sidebar.jsx';
import { Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Admin/Dashboard.jsx';
import AllAppointments from './pages/Admin/AllAppointments.jsx';
import AddDoctor from './pages/Admin/AddDoctor.jsx';
import DoctorsList from './pages/Admin/DoctorsList.jsx';
import { DoctorContext } from './context/DoctorContext.jsx';
import DoctorAppointment from './pages/Doctor/DoctorAppointment.jsx';
import DoctorDashboard from './pages/Doctor/DoctorDashboard.jsx';
import DoctorProfile from './pages/Doctor/DoctorProfile.jsx';
import DocMessages from "./pages/Doctor/DocChatPage.jsx"

const App = () => {

  const {aToken} = useContext(AdminContext)
  const {dToken} = useContext(DoctorContext)

  return aToken || dToken ? (
    <div className='bg-[#F8F9FD]'>
      <ToastContainer/>
      <Navbar/>
      <div className='flex items-start'>
        <Sidebar/>
        <Routes>
          {/* Admin Routes */}
          <Route path='/' element={<></>}/>  {/* We will not display any UI when doctor and admin is logged in   */}
          <Route path='/admin-dashboard' element={<Dashboard/>}/>
          <Route path='/all-appointments' element={<AllAppointments/>}/>
          <Route path='/add-doctor' element={<AddDoctor/>}/>
          <Route path='/doctor-list' element={<DoctorsList/>}/>
          {/* Doctor Routes */}
          <Route path='/doctor-dashboard' element={<DoctorDashboard/>}/>
          <Route path='/doctor-appointments' element={<DoctorAppointment/>}/>
          <Route path='/doctor-profile' element={<DoctorProfile/>}/>
          <Route path="/doctor-messages" element={<DocMessages />} />
        </Routes>
      </div>
    </div>
  ) : (
    <>
      <Login/>
      <ToastContainer/>
    </>
  )
}

export default App