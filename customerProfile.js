import { LightningElement, track, wire } from 'lwc';
import saveProfileData from '@salesforce/apex/ProfileController.saveProfileData';
import exampleImage from '@salesforce/resourceUrl/example_image';
import getProfileData from '@salesforce/apex/ProfileController.getProfileData';
import { CurrentPageReference } from 'lightning/navigation';
import postCustomerInfo from '@salesforce/apex/PostCustomerInfo.postCustomerInfo'; // Import the postCustomerInfo Apex method

export default class CustomerProfilePage extends LightningElement {
    @track currentPageReference;
    @track phone = '';
    @track dob = '';
    @track tshirtSize = '';
    @track shoeSize = '';
    @track errorMessage = '';
    secureToken = ''; // This will hold the secure token
    imageUrl = exampleImage;
    @track isModalOpen = false;
    @track modalMessage = '';
    @track isSaveButtonDisabled = false;
    @track contact = {};

    // Options for T-shirt size
    tshirtSizeOptions = [
        { label: 'XS', value: 'XS' },
        { label: 'S', value: 'S' },
        { label: 'M', value: 'M' },
        { label: 'L', value: 'L' },
        { label: 'XL', value: 'XL' },
        { label: 'XXL', value: 'XXL' }
    ];

    // Shoe size options
    shoeSizeOptions = Array.from({ length: 21 }, (_, i) => ({
        label: (6 + i * 0.5).toFixed(1),
        value: (6 + i * 0.5).toFixed(1)
    }));

    // Wire method to get the current page reference and extract the token
    @wire(CurrentPageReference)
    getPageReference(pageRef) {
        this.currentPageReference = pageRef;
        if (pageRef && pageRef.state) {
            const tempToken = pageRef.state.token || null;
            this.secureToken = tempToken;
            console.log('Secure Token:', this.secureToken);
        }
    }

    // Wire method to fetch profile data using the secureToken
    @wire(getProfileData, { secureToken: '$secureToken' })
    wiredContact({ data, error }) {
        if (data) {
            const parsedData = JSON.parse(data);
            this.contact = parsedData;
            this.phone = parsedData.Phone;
            this.dob = parsedData.Date_of_Birth__c;
            this.tshirtSize = parsedData.T_Shirt_Size__pc;
            this.shoeSize = parsedData.Shoe_Size__pc;
            this.errorMessage = undefined;
        } else if (error) {
            this.errorMessage = error.body.message || 'An error occurred while fetching profile data.';
            this.contact = {};
            console.error('Error fetching profile data:', error);
        }
    }

    connectedCallback() {
        this.isModalOpen = false; // Modal should be closed by default
    }

    // Handle input changes for various fields
    handleOnChange(event) {
        const field = event.target.dataset.field;
        this[field] = event.target.value;
    }

    // Close the modal
    closeModal() {
        this.isModalOpen = false;
    }

    // Validate phone number to ensure it's 10 digits
    validatePhoneNumber(phoneNumber) {
        const phoneRegex = /^\d{10}$/; // Matches exactly 10 digits
        return phoneRegex.test(phoneNumber);
    }

    // Handle the save button click
    async handleSave() {
        try {
            this.isSaveButtonDisabled = true; // Disable button to prevent multiple clicks

            // Validate the phone number
            if (!this.validatePhoneNumber(this.phone)) {
                this.errorMessage = 'Please enter a valid 10-digit phone number.';
                this.isModalOpen = true;
                this.isSaveButtonDisabled = false; // Re-enable button
                return;
            }

            // Format shoe size and date of birth (DOB)
            const formattedShoeSize = this.shoeSize ? parseFloat(this.shoeSize) : null;
            const formattedDob = this.dob ? new Date(this.dob).toISOString().split('T')[0] : null;

            // Call Apex method to save profile data
            const response = await saveProfileData({
                secureToken: this.secureToken,
                phone: this.phone,
                dob: formattedDob,
                tshirtSize: this.tshirtSize,
                shoeSize: formattedShoeSize
            });

            console.log('Response:', response);

            // Show modal with the appropriate message
            if (response.includes('Success')) {
                this.modalMessage = 'Profile updated successfully!';
                this.isModalOpen = true;

                // After saving profile, call postCustomerInfo to send the data to the external system
                await this.sendCustomerInfo();
            } else {
                this.modalMessage = 'Failed to update profile. Please try again.';
                this.isModalOpen = true;
            }
        } catch (error) {
            console.error('Error in saveProfileData:', error);
            this.modalMessage = 'An unexpected error occurred while saving your profile.';
            this.isModalOpen = true;
        } finally {
            this.isSaveButtonDisabled = false; // Re-enable button
        }
    }

    // Method to call the postCustomerInfo Apex method
    async sendCustomerInfo() {
        try {
            // Check if contact exists and if it has an Id field
            if (this.contact && this.contact.Id) {
                const accountId = this.contact.Id; // Retrieve account ID

                // Call the Apex method postCustomerInfo with the account ID
                const result = await postCustomerInfo({ accountId });
                console.log('Customer Info Posted:', result);
            } else {
                console.error('No contact or contact ID found');
                this.modalMessage = 'No valid contact information available for posting.';
                this.isModalOpen = true;
            }
        } catch (error) {
            console.error('Error posting customer info:', error);
            this.modalMessage = 'Error posting customer information to the external system. Please try again.';
            this.isModalOpen = true;
        }
    }
}
